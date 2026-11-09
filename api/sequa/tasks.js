import { verifyUser, ensureDefaultMembers, VET_EMAIL } from '../lib/auth.js';
import clientPromise, { getDbName } from '../../lib/mongodb.js';
import { isUserOnLeave } from '../../lib/assignmentResolver.js';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const contextRefSchema = z
    .object({
        module: z.string().max(60).nullable().optional(),
        entityType: z.string().max(60).nullable().optional(),
        entityId: z.string().max(120).nullable().optional(),
        label: z.string().max(150).nullable().optional()
    })
    .nullable()
    .optional();

const createSequaSchema = z.object({
    title: z.string().min(2, 'Başlık en az 2 karakter olmalıdır.').max(180),
    description: z.string().max(1500).optional().default(''),
    taskType: z.enum(['task', 'vet_request', 'issue_report', 'external']).default('task'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    assignedTo: z.string().email().nullable().optional().or(z.literal('')),
    reviewerEmail: z.string().email().nullable().optional().or(z.literal('')),
    externalUnit: z.string().max(150).nullable().optional(),
    externalContact: z.string().max(150).nullable().optional(),
    externalTicketNo: z.string().max(80).nullable().optional(),
    dueDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitiş tarihi YYYY-MM-DD formatında olmalıdır.')
        .nullable()
        .optional()
        .or(z.literal('')),
    sourceRitusRunId: z.string().nullable().optional(),
    contextRef: contextRefSchema
});

const patchSequaSchema = z.object({
    id: z.string().min(1, 'Görev ID gereklidir.'),
    action: z
        .enum([
            'move_status',
            'convert_to_task',
            'request_revision',
            'approve',
            'add_note',
            'reassign'
        ])
        .default('move_status'),
    status: z.enum(['reported', 'todo', 'in_progress', 'review', 'done']).optional(),
    taskType: z.enum(['task', 'vet_request', 'issue_report', 'external']).optional(),
    assignedTo: z.string().email().nullable().optional().or(z.literal('')),
    reviewerEmail: z.string().email().nullable().optional().or(z.literal('')),
    externalUnit: z.string().max(150).nullable().optional(),
    externalTicketNo: z.string().max(80).nullable().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    note: z.string().max(1000).optional().default('')
});

const DEFAULT_SEQUA_TASKS = [
    {
        title: 'Fare Odası-1 Raf B3 Kafes #14 Klinik Muayene Talebi',
        description:
            'Kafes değişimi sırasında 1 erkek C57BL/6 farede piloereksiyon, kamburlaşma ve lokomotor aktivitede azalma gözlemlendi. Hocam gelip kontrol edebilir misiniz?',
        taskType: 'vet_request',
        priority: 'high',
        status: 'todo',
        createdBy: 'kubra.celik@medeniyet.edu.tr',
        createdByName: 'Kübra Çelik',
        createdByRole: 'technician',
        assignedTo: 'oguzhan.baygul@medeniyet.edu.tr',
        assignedToRole: 'vet',
        reviewerEmail: 'oguzhan.baygul@medeniyet.edu.tr',
        externalUnit: null,
        externalTicketNo: null,
        sourceRitusRunId: null,
        contextRef: { module: 'Locus', entityType: 'cage', entityId: 'B3-14', label: 'Fare Odası-1 / B3-14' },
        revisionCount: 0
    },
    {
        title: 'Yıkama Odası Gider Süzgeci Tıkanıklığı Bildirimi',
        description:
            'Kafes yıkama sonrası kirli koridor giderinde su tahliyesi yavaşladı, taşma riski var.',
        taskType: 'issue_report',
        priority: 'medium',
        status: 'reported',
        createdBy: 'gokhan.sert@medeniyet.edu.tr',
        createdByName: 'Gökhan Sert',
        createdByRole: 'caretaker',
        assignedTo: 'kubra.celik@medeniyet.edu.tr',
        assignedToRole: 'technician',
        reviewerEmail: 'kubra.celik@medeniyet.edu.tr',
        externalUnit: null,
        externalTicketNo: null,
        sourceRitusRunId: null,
        contextRef: null,
        revisionCount: 0
    },
    {
        title: 'Sıçan Odası-2 HEPA Filtre & Fark Basınç Sensörü Arızası',
        description:
            'Oda pozitif basınç sensörü kalibrasyon uyarısı veriyor. Üniversite Yapı İşleri mekanik biriminden teknik ekip talep edildi.',
        taskType: 'external',
        priority: 'critical',
        status: 'in_progress',
        createdBy: 'oguzhan.baygul@medeniyet.edu.tr',
        createdByName: 'Oğuzhan Baygül',
        createdByRole: 'vet',
        assignedTo: 'kubra.celik@medeniyet.edu.tr',
        assignedToRole: 'technician',
        reviewerEmail: 'oguzhan.baygul@medeniyet.edu.tr',
        externalUnit: 'Yapı İşleri ve Teknik Daire Başkanlığı',
        externalTicketNo: 'YIT-2026-418',
        sourceRitusRunId: null,
        contextRef: { module: 'Locus', entityType: 'room', entityId: 'SICAN-2', label: 'Sıçan Odası-2 HVAC' },
        revisionCount: 0
    }
];

async function ensureDefaultSequaTasks(db) {
    const col = db.collection('sequa_tasks');
    const count = await col.countDocuments();
    if (count === 0) {
        const now = new Date();
        await col.insertMany(
            DEFAULT_SEQUA_TASKS.map(t => ({
                ...t,
                activityLog: [
                    {
                        action: 'created',
                        by: t.createdBy,
                        byName: t.createdByName,
                        at: now,
                        note: 'Kayıt oluşturuldu.'
                    }
                ],
                createdAt: now,
                updatedAt: now
            }))
        );
    }
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
    await ensureDefaultMembers(db);
    await ensureDefaultSequaTasks(db);

    const sequaCol = db.collection('sequa_tasks');
    const membersCol = db.collection('members');

    if (req.method === 'GET') {
        try {
            const filter = {};
            if (req.query?.taskType && typeof req.query.taskType === 'string') {
                filter.taskType = req.query.taskType.trim();
            }
            if (req.query?.status && typeof req.query.status === 'string') {
                filter.status = req.query.status.trim();
            }
            if (req.query?.assignedTo && typeof req.query.assignedTo === 'string') {
                filter.assignedTo = req.query.assignedTo.trim().toLowerCase();
            }
            if (req.query?.sourceRitusRunId && typeof req.query.sourceRitusRunId === 'string') {
                filter.sourceRitusRunId = req.query.sourceRitusRunId.trim();
            }

            const tasks = await sequaCol.find(filter).sort({ createdAt: -1 }).toArray();
            return res.status(200).json({ tasks });
        } catch (error) {
            console.error('GET /api/sequa/tasks error:', error);
            return res.status(500).json({ error: 'Sequa görevleri alınırken hata oluştu.' });
        }
    }

    if (req.method === 'POST') {
        const parsed = createSequaSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.issues?.[0]?.message || 'Geçersiz görev verisi.'
            });
        }

        const data = parsed.data;
        const userRole = user.pulsusRole;
        const userEmail = user.email.toLowerCase();

        // Role enforcement for Caretaker
        if (userRole === 'caretaker') {
            if (data.taskType === 'task' || data.taskType === 'external') {
                return res.status(403).json({
                    error: 'Bakıcı/Temizlik personeli doğrudan görev atayamaz; yalnızca Teknikere veya Veteriner Hekime Problem Bildirimi (issue_report) açabilir.'
                });
            }
        }

        try {
            const members = await membersCol.find({}).toArray();
            const memberMap = new Map(members.map(m => [m.email.toLowerCase(), m]));

            let targetEmail = data.assignedTo ? data.assignedTo.trim().toLowerCase() : null;
            if (data.taskType === 'vet_request' && !targetEmail) {
                targetEmail = VET_EMAIL;
            }
            if (!targetEmail) {
                // Default target: if caretaker reports an issue, route to first technician or Vet
                if (userRole === 'caretaker') {
                    const tech = members.find(m => m.pulsusRole === 'technician');
                    targetEmail = tech ? tech.email.toLowerCase() : VET_EMAIL;
                } else {
                    targetEmail = VET_EMAIL;
                }
            }

            const targetMember = memberMap.get(targetEmail);
            const targetRole = targetMember?.pulsusRole || (targetEmail === VET_EMAIL ? 'vet' : 'caretaker');

            // Additional guard: Caretaker cannot direct an issue_report or vet_request to another Caretaker
            if (userRole === 'caretaker' && targetRole === 'caretaker') {
                return res.status(403).json({
                    error: 'Bakıcı/Temizlik personeli diğer bir bakıcıya iş veya bildirim atayamaz; yalnızca Teknikere veya Veteriner Hekime bildirim açabilir.'
                });
            }

            // Check if target is on leave today (or on dueDate) in Circa_db
            const checkDateStr =
                data.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)
                    ? data.dueDate
                    : new Date().toISOString().slice(0, 10);

            let effectiveAssignee = targetEmail;
            let delegatedFrom = null;
            let leaveDelegationNote = null;

            const leaveCheck = await isUserOnLeave(client, targetEmail, checkDateStr, null);
            if (leaveCheck.onLeave && targetEmail !== VET_EMAIL) {
                const backupEmail = targetMember?.defaultBackupEmail?.toLowerCase();
                if (backupEmail && backupEmail !== targetEmail) {
                    const backupLeave = await isUserOnLeave(client, backupEmail, checkDateStr, null);
                    if (!backupLeave.onLeave) {
                        effectiveAssignee = backupEmail;
                        delegatedFrom = targetEmail;
                        leaveDelegationNote = `${targetEmail} izinli olduğu için yedek personel (${backupEmail}) devreye girdi.`;
                    } else {
                        effectiveAssignee = VET_EMAIL;
                        delegatedFrom = targetEmail;
                        leaveDelegationNote = `${targetEmail} ve yedeği izinli olduğu için Sorumlu Veteriner Hekime (${VET_EMAIL}) devredildi.`;
                    }
                } else {
                    effectiveAssignee = VET_EMAIL;
                    delegatedFrom = targetEmail;
                    leaveDelegationNote = `${targetEmail} izinli olduğu için Sorumlu Veteriner Hekime (${VET_EMAIL}) devredildi.`;
                }
            }

            const effectiveMember = memberMap.get(effectiveAssignee);
            const effectiveRole =
                effectiveMember?.pulsusRole || (effectiveAssignee === VET_EMAIL ? 'vet' : 'caretaker');

            const initialStatus = data.taskType === 'issue_report' ? 'reported' : 'todo';
            const reviewerEmail = data.reviewerEmail
                ? data.reviewerEmail.trim().toLowerCase()
                : userRole === 'caretaker'
                  ? effectiveAssignee
                  : userEmail;

            const now = new Date();
            const newDoc = {
                title: data.title.trim(),
                description: (data.description || '').trim(),
                taskType: data.taskType,
                priority: data.priority || 'medium',
                status: initialStatus,
                createdBy: userEmail,
                createdByName: user.name,
                createdByRole: userRole,
                assignedTo: effectiveAssignee,
                assignedToRole: effectiveRole,
                primaryAssignee: targetEmail,
                delegatedFrom,
                leaveDelegationNote,
                reviewerEmail,
                externalUnit: data.taskType === 'external' ? (data.externalUnit || 'Üniversite Birimi').trim() : null,
                externalContact: data.externalContact || null,
                externalTicketNo: data.externalTicketNo || null,
                dueDate: data.dueDate || null,
                sourceRitusRunId: data.sourceRitusRunId || null,
                contextRef: data.contextRef || null,
                revisionCount: 0,
                activityLog: [
                    {
                        action: 'created',
                        by: userEmail,
                        byName: user.name,
                        at: now,
                        note: leaveDelegationNote || 'Kayıt oluşturuldu.'
                    }
                ],
                createdAt: now,
                updatedAt: now
            };

            const insertRes = await sequaCol.insertOne(newDoc);
            const createdTask = { ...newDoc, _id: insertRes.insertedId };

            // Link back to Ritus run if sourceRitusRunId was provided
            if (data.sourceRitusRunId && ObjectId.isValid(data.sourceRitusRunId)) {
                await db.collection('ritus_runs').updateOne(
                    { _id: new ObjectId(data.sourceRitusRunId) },
                    {
                        $addToSet: { spawnedSequaIds: insertRes.insertedId.toString() },
                        $set: { updatedAt: now }
                    }
                );
            }

            return res.status(201).json({ task: createdTask });
        } catch (error) {
            console.error('POST /api/sequa/tasks error:', error);
            return res.status(500).json({ error: 'Sequa görevi oluşturulurken hata oluştu.' });
        }
    }

    if (req.method === 'PATCH') {
        const parsed = patchSequaSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.issues?.[0]?.message || 'Geçersiz güncelleme verisi.'
            });
        }

        const data = parsed.data;
        if (!ObjectId.isValid(data.id)) {
            return res.status(400).json({ error: 'Geçersiz görev ID formatı.' });
        }

        try {
            const taskObjectId = new ObjectId(data.id);
            const existing = await sequaCol.findOne({ _id: taskObjectId });
            if (!existing) {
                return res.status(404).json({ error: 'Sequa görevi bulunamadı.' });
            }

            const userRole = user.pulsusRole;
            const userEmail = user.email.toLowerCase();
            const now = new Date();

            // 1. convert_to_task (Technician or Vet converts an upward issue_report into an actionable task or external ticket)
            if (data.action === 'convert_to_task') {
                if (userRole === 'caretaker') {
                    return res.status(403).json({
                        error: 'Problem bildirimini göreve dönüştürme yetkisi yalnızca Tekniker ve Veteriner Hekime aittir.'
                    });
                }

                const newTaskType = data.taskType || (data.externalUnit ? 'external' : 'task');
                const newAssignee = data.assignedTo
                    ? data.assignedTo.trim().toLowerCase()
                    : existing.assignedTo;

                const updatePayload = {
                    taskType: newTaskType,
                    status: data.status || 'todo',
                    assignedTo: newAssignee,
                    reviewerEmail: userEmail,
                    externalUnit:
                        newTaskType === 'external'
                            ? (data.externalUnit || existing.externalUnit || 'Üniversite Teknik Birimi')
                            : existing.externalUnit,
                    externalTicketNo: data.externalTicketNo ?? existing.externalTicketNo,
                    priority: data.priority || existing.priority,
                    updatedAt: now
                };

                const logEntry = {
                    action: 'convert_to_task',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note:
                        data.note ||
                        `Problem bildirimi ${newTaskType === 'external' ? 'Dış Birim İşine' : 'Atanmış Göreve'} dönüştürüldü.`
                };

                await sequaCol.updateOne(
                    { _id: taskObjectId },
                    {
                        $set: updatePayload,
                        $push: { activityLog: logEntry }
                    }
                );

                const updated = await sequaCol.findOne({ _id: taskObjectId });
                return res.status(200).json({ task: updated });
            }

            // 2. request_revision
            if (data.action === 'request_revision') {
                if (userRole === 'caretaker') {
                    return res.status(403).json({
                        error: 'Bakıcı/Temizlik personeli revizyon talep edemez.'
                    });
                }
                if (!data.note || data.note.trim().length < 2) {
                    return res.status(400).json({
                        error: 'Revizyon (tekrar) gerekçesi belirtilmelidir.'
                    });
                }

                const logEntry = {
                    action: 'request_revision',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note: data.note.trim()
                };

                await sequaCol.updateOne(
                    { _id: taskObjectId },
                    {
                        $set: {
                            status: 'in_progress',
                            lastRevisionNote: data.note.trim(),
                            updatedAt: now
                        },
                        $inc: { revisionCount: 1 },
                        $push: { activityLog: logEntry }
                    }
                );

                const updated = await sequaCol.findOne({ _id: taskObjectId });
                return res.status(200).json({ task: updated });
            }

            // 3. approve / move_status to 'done'
            if (data.action === 'approve' || data.status === 'done') {
                if (userRole === 'caretaker') {
                    return res.status(403).json({
                        error: 'Bakıcı/Temizlik personeli görevi doğrudan tamamlandı (Onay) durumuna alamaz; lütfen Denetim (review) sütununa gönderiniz.'
                    });
                }

                const logEntry = {
                    action: 'approve',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note: data.note || 'Görev onaylandı ve kapatıldı.'
                };

                await sequaCol.updateOne(
                    { _id: taskObjectId },
                    {
                        $set: {
                            status: 'done',
                            completedAt: now,
                            completedBy: userEmail,
                            updatedAt: now
                        },
                        $push: { activityLog: logEntry }
                    }
                );

                const updated = await sequaCol.findOne({ _id: taskObjectId });
                return res.status(200).json({ task: updated });
            }

            // 4. reassign
            if (data.action === 'reassign') {
                if (userRole === 'caretaker') {
                    return res.status(403).json({
                        error: 'Bakıcı/Temizlik personeli görev devredemez.'
                    });
                }
                if (!data.assignedTo) {
                    return res.status(400).json({ error: 'Yeni sorumlu e-posta adresi gereklidir.' });
                }

                const cleanTarget = data.assignedTo.trim().toLowerCase();
                const logEntry = {
                    action: 'reassign',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note: data.note || `Görev ${cleanTarget} personeline atandı.`
                };

                await sequaCol.updateOne(
                    { _id: taskObjectId },
                    {
                        $set: {
                            assignedTo: cleanTarget,
                            updatedAt: now
                        },
                        $push: { activityLog: logEntry }
                    }
                );

                const updated = await sequaCol.findOne({ _id: taskObjectId });
                return res.status(200).json({ task: updated });
            }

            // 5. move_status or add_note
            const setFields = { updatedAt: now };
            if (data.status) {
                setFields.status = data.status;
            }
            if (data.priority) {
                setFields.priority = data.priority;
            }
            if (data.externalUnit !== undefined) {
                setFields.externalUnit = data.externalUnit;
            }
            if (data.externalTicketNo !== undefined) {
                setFields.externalTicketNo = data.externalTicketNo;
            }

            const logEntry = {
                action: data.action,
                by: userEmail,
                byName: user.name,
                at: now,
                note:
                    data.note ||
                    (data.status ? `Durum '${data.status}' olarak güncellendi.` : 'Not eklendi.')
            };

            await sequaCol.updateOne(
                { _id: taskObjectId },
                {
                    $set: setFields,
                    $push: { activityLog: logEntry }
                }
            );

            const updated = await sequaCol.findOne({ _id: taskObjectId });
            return res.status(200).json({ task: updated });
        } catch (error) {
            console.error('PATCH /api/sequa/tasks error:', error);
            return res.status(500).json({ error: 'Sequa görevi güncellenirken hata oluştu.' });
        }
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
}
