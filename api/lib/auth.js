import { verifyAuthWithStatus } from '../../lib/auth.js';
import clientPromise, { getDbName } from '../../lib/mongodb.js';

export const VET_EMAIL = 'oguzhan.baygul@medeniyet.edu.tr';

export const DEFAULT_LAB_MEMBERS = [
    {
        email: 'oguzhan.baygul@medeniyet.edu.tr',
        name: 'Oğuzhan Baygül',
        pulsusRole: 'vet',
        title: 'Sorumlu Veteriner Hekim',
        defaultBackupEmail: 'kubra.celik@medeniyet.edu.tr',
        isActive: true
    },
    {
        email: 'kubra.celik@medeniyet.edu.tr',
        name: 'Kübra Çelik',
        pulsusRole: 'technician',
        title: 'Veteriner Sağlık Teknikeri',
        defaultBackupEmail: 'gamze.demir@medeniyet.edu.tr',
        isActive: true
    },
    {
        email: 'gamze.demir@medeniyet.edu.tr',
        name: 'Gamze Demir',
        pulsusRole: 'technician',
        title: 'Laboratuvar Teknikeri',
        defaultBackupEmail: 'kubra.celik@medeniyet.edu.tr',
        isActive: true
    },
    {
        email: 'gokhan.sert@medeniyet.edu.tr',
        name: 'Gökhan Sert',
        pulsusRole: 'caretaker',
        title: 'Hayvan Bakıcısı / Temizlik Görevlisi',
        defaultBackupEmail: 'yusufenes.isik@medeniyet.edu.tr',
        isActive: true
    },
    {
        email: 'yusufenes.isik@medeniyet.edu.tr',
        name: 'Yusuf Enes Işık',
        pulsusRole: 'caretaker',
        title: 'Hayvan Bakıcısı / Temizlik Görevlisi',
        defaultBackupEmail: 'gokhan.sert@medeniyet.edu.tr',
        isActive: true
    }
];

export function resolveDefaultMemberProfile(email, name = null, isAdmin = false) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const predefined = DEFAULT_LAB_MEMBERS.find(m => m.email.toLowerCase() === normalizedEmail);
    if (isAdmin || normalizedEmail === VET_EMAIL) {
        return {
            email: normalizedEmail,
            name: name || predefined?.name || normalizedEmail.split('@')[0],
            pulsusRole: 'vet',
            title: predefined?.title || 'Sorumlu Veteriner Hekim',
            defaultBackupEmail: predefined?.defaultBackupEmail || 'kubra.celik@medeniyet.edu.tr',
            isActive: true
        };
    }
    if (predefined) {
        return {
            ...predefined,
            name: name || predefined.name
        };
    }
    return {
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        pulsusRole: 'caretaker',
        title: 'Hayvan Bakıcısı / Temizlik Görevlisi',
        defaultBackupEmail: null,
        isActive: true
    };
}

let lastDefaultMembersSync = 0;
const DEFAULT_MEMBERS_SYNC_TTL_MS = 5 * 60 * 1000;

export async function ensureDefaultMembers(db, client = null) {
    const membersCol = db.collection('members');
    const count = await membersCol.countDocuments();
    const now = new Date();

    if (count === 0) {
        await membersCol.insertMany(
            DEFAULT_LAB_MEMBERS.map(m => ({
                ...m,
                createdAt: now,
                updatedAt: now
            }))
        );
    }

    // Skip recurring sync if within TTL
    if (Date.now() - lastDefaultMembersSync < DEFAULT_MEMBERS_SYNC_TTL_MS && count > 0) {
        return;
    }

    // Sync with Apex_db.users: only users with 'pulsus' access or 'admin' role belong in Pulsus
    if (client) {
        try {
            const apexDb = client.db(getDbName('Apex_db'));
            const allApexUsers = await apexDb.collection('users').find({}).toArray();

            if (allApexUsers.length > 0) {
                const existingEmails = new Set(await membersCol.distinct('email'));
                const revokedEmails = [];
                for (const u of allApexUsers) {
                    const emailLower = String(u.email || '').trim().toLowerCase();
                    if (!emailLower) continue;
                    const hasPulsusAccess =
                        u.role === 'admin' ||
                        (Array.isArray(u.apps) &&
                            u.apps.some(a => String(a).toLowerCase() === 'pulsus'));

                    if (hasPulsusAccess) {
                        if (!existingEmails.has(emailLower)) {
                            const profile = resolveDefaultMemberProfile(
                                emailLower,
                                u.name,
                                u.role === 'admin'
                            );
                            await membersCol.insertOne({
                                ...profile,
                                createdAt: now,
                                updatedAt: now
                            });
                            existingEmails.add(emailLower);
                        }
                    } else {
                        revokedEmails.push(emailLower);
                    }
                }

                if (revokedEmails.length > 0) {
                    await membersCol.deleteMany({ email: { $in: revokedEmails } });
                }
            }
        } catch {
            // Ignore cross-db sync errors if any
        }
    }
    lastDefaultMembersSync = Date.now();
}

export async function verifyUser(req) {
    const { user, status, error } = await verifyAuthWithStatus(req, 'pulsus');
    if (!user) {
        throw { status: status || 401, message: error || 'Authentication failed' };
    }

    const normalizedEmail = user.email.toLowerCase();
    const isAdmin = user.role === 'admin' || normalizedEmail === VET_EMAIL;
    let member = null;

    try {
        const client = await clientPromise;
        const db = client.db(getDbName('Pulsus_db'));
        if (Date.now() - lastDefaultMembersSync >= DEFAULT_MEMBERS_SYNC_TTL_MS) {
            await ensureDefaultMembers(db, client).catch(() => {});
        }

        const membersCol = db.collection('members');
        member = await membersCol.findOne({
            email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });

        if (!member) {
            const defaultProfile = resolveDefaultMemberProfile(normalizedEmail, user.name, isAdmin);
            const now = new Date();
            const newDoc = {
                ...defaultProfile,
                createdAt: now,
                updatedAt: now
            };
            await membersCol.insertOne(newDoc).catch(() => {});
            member = newDoc;
        }
    } catch (err) {
        console.warn('[auth] Member profile db lookup warning:', err.message);
    }

    if (!member) {
        member = resolveDefaultMemberProfile(normalizedEmail, user.name, isAdmin);
    }

    const pulsusRole = member.pulsusRole || (isAdmin ? 'vet' : 'caretaker');
    const title =
        member.title ||
        (pulsusRole === 'vet'
            ? 'Sorumlu Veteriner Hekim'
            : pulsusRole === 'technician'
              ? 'Veteriner Sağlık Teknikeri'
              : 'Hayvan Bakıcısı / Temizlik Görevlisi');

    return {
        ...user,
        name: member.name || user.name || user.email.split('@')[0],
        pulsusRole,
        title
    };
}
