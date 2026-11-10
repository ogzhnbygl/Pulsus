import { verifyUser, ensureDefaultMembers } from '../lib/auth.js';
import clientPromise, { getDbName } from '../../lib/mongodb.js';
import { doesLeaveMatchDateAndTime, toDateKey } from '../../lib/assignmentResolver.js';
import { syncPendingRunsWithCircaLeaves } from '../../lib/ritusEngine.js';
import { z } from 'zod';

const memberPostOrPutSchema = z.object({
    email: z.string().email('Geçerli bir e-posta adresi giriniz.').max(150),
    name: z.string().min(2, 'İsim en az 2 karakter olmalıdır.').max(120).optional(),
    pulsusRole: z.enum(['vet', 'technician', 'caretaker']),
    title: z.string().min(2, 'Ünvan en az 2 karakter olmalıdır.').max(120),
    defaultBackupEmail: z.string().email().nullable().optional().or(z.literal('')),
    isActive: z.boolean().optional().default(true)
});

function extractUpcomingLeaveDates(leaveDocs, todayStr) {
    const upcoming = [];
    for (const doc of leaveDocs) {
        if (doc.status !== 'approved') continue;
        if (doc.unit === 'daily' && Array.isArray(doc.dates)) {
            const matchedDates = doc.dates
                .map(d => toDateKey(d))
                .filter(d => d && d >= todayStr)
                .sort();
            if (matchedDates.length > 0) {
                upcoming.push({
                    _id: doc._id,
                    unit: 'daily',
                    dates: matchedDates,
                    startTime: null,
                    endTime: null
                });
            }
        } else if (doc.unit === 'hourly' && doc.singleDate) {
            const dKey = toDateKey(doc.singleDate);
            if (dKey && dKey >= todayStr) {
                upcoming.push({
                    _id: doc._id,
                    unit: 'hourly',
                    dates: [dKey],
                    singleDate: dKey,
                    startTime: doc.startTime || null,
                    endTime: doc.endTime || null
                });
            }
        }
    }
    return upcoming;
}

export default async function handler(req, res) {
    let user;
    try {
        user = await verifyUser(req);
    } catch (error) {
        return res.status(error.status || 401).json({ error: error.message });
    }

    const client = await clientPromise;
    const db = client.db(getDbName('Pulsus_db'));
    await ensureDefaultMembers(db, client);
    const membersCol = db.collection('members');

    if (req.method === 'GET') {
        try {
            const todayStr = (req.query?.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date))
                ? req.query.date
                : new Date().toISOString().slice(0, 10);

            const members = await membersCol
                .find({ isActive: { $ne: false } })
                .sort({ pulsusRole: 1, name: 1 })
                .toArray();
            const circaDb = client.db(getDbName('Circa_db'));
            const approvedLeaves = await circaDb
                .collection('time_offs')
                .find({ status: 'approved' })
                .toArray();

            const roleOrder = { vet: 0, technician: 1, caretaker: 2 };

            const enrichedMembers = members
                .map(m => {
                    const emailLower = String(m.email || '').trim().toLowerCase();
                    const userLeaves = approvedLeaves.filter(
                        l => String(l.email || '').trim().toLowerCase() === emailLower
                    );
                    const todayLeaveDoc = userLeaves.find(l => doesLeaveMatchDateAndTime(l, todayStr, null));
                    const upcomingLeaves = extractUpcomingLeaveDates(userLeaves, todayStr);

                    return {
                        ...m,
                        onLeaveToday: Boolean(todayLeaveDoc),
                        todayLeaveInfo: todayLeaveDoc
                            ? {
                                  unit: todayLeaveDoc.unit,
                                  startTime: todayLeaveDoc.startTime || null,
                                  endTime: todayLeaveDoc.endTime || null
                              }
                            : null,
                        upcomingLeaves
                    };
                })
                .sort((a, b) => (roleOrder[a.pulsusRole] ?? 9) - (roleOrder[b.pulsusRole] ?? 9));

            return res.status(200).json({ members: enrichedMembers, referenceDate: todayStr });
        } catch (error) {
            console.error('GET /api/members error:', error);
            return res.status(500).json({ error: 'Personel listesi alınırken bir hata oluştu.' });
        }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
        if (user.pulsusRole !== 'vet' && user.role !== 'admin') {
            return res.status(403).json({
                error: 'Personel rol ve yedek yapılandırmasını yalnızca Yönetici / Sorumlu Veteriner Hekim değiştirebilir.'
            });
        }

        const parsed = memberPostOrPutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.issues?.[0]?.message || 'Geçersiz personel verisi.'
            });
        }

        try {
            const data = parsed.data;
            const normalizedEmail = data.email.trim().toLowerCase();
            const cleanBackup = data.defaultBackupEmail ? data.defaultBackupEmail.trim().toLowerCase() : null;
            const finalRole = data.pulsusRole;
            const now = new Date();

            const existing = await membersCol.findOne({ email: normalizedEmail });
            const updateFields = {
                email: normalizedEmail,
                name: data.name?.trim() || existing?.name || normalizedEmail.split('@')[0],
                pulsusRole: finalRole,
                title: data.title.trim(),
                defaultBackupEmail: cleanBackup,
                isActive: data.isActive ?? true,
                updatedAt: now
            };

            if (existing) {
                await membersCol.updateOne({ email: normalizedEmail }, { $set: updateFields });
            } else {
                await membersCol.insertOne({ ...updateFields, createdAt: now });
            }

            // Propagate role and backup changes to active templates, pending Ritus runs, and open Sequa tasks
            await db.collection('sequa_tasks').updateMany(
                { assignedTo: normalizedEmail, status: { $ne: 'done' } },
                { $set: { assignedToRole: finalRole, updatedAt: now } }
            );

            if (existing && existing.defaultBackupEmail !== cleanBackup) {
                await db.collection('ritus_templates').updateMany(
                    {
                        primaryAssignee: normalizedEmail,
                        $or: [
                            { backupAssignee: existing.defaultBackupEmail || null },
                            { backupAssignee: null }
                        ]
                    },
                    { $set: { backupAssignee: cleanBackup, updatedAt: now } }
                );
                await db.collection('ritus_runs').updateMany(
                    {
                        primaryAssignee: normalizedEmail,
                        status: 'todo'
                    },
                    { $set: { backupAssignee: cleanBackup, updatedAt: now } }
                );
            }

            await syncPendingRunsWithCircaLeaves(client, db);

            const saved = await membersCol.findOne({ email: normalizedEmail });
            return res.status(existing ? 200 : 201).json({ member: saved });
        } catch (error) {
            console.error('POST/PUT /api/members error:', error);
            return res.status(500).json({ error: 'Personel kaydı güncellenirken hata oluştu.' });
        }
    }

    if (req.method === 'DELETE') {
        if (user.pulsusRole !== 'vet' && user.role !== 'admin') {
            return res.status(403).json({
                error: 'Personel silme yetkisi yalnızca Yönetici / Sorumlu Veteriner Hekime aittir.'
            });
        }
        const emailParam = String(req.query?.email || '').trim().toLowerCase();
        if (!emailParam) {
            return res.status(400).json({ error: 'Silinecek personelin e-posta adresi gereklidir.' });
        }
        if (emailParam === user.email.toLowerCase()) {
            return res.status(400).json({ error: 'Kendi aktif personel kaydınızı silemezsiniz.' });
        }
        await membersCol.deleteOne({ email: emailParam });
        // Also revoke 'pulsus' module access in Apex_db.users so they don't get re-synced
        try {
            const apexDb = client.db(getDbName('Apex_db'));
            await apexDb
                .collection('users')
                .updateOne({ email: emailParam }, { $pull: { apps: 'pulsus' } });
        } catch {
            // Ignore cross-db update error if any
        }
        return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
}
