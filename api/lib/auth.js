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
        defaultBackupEmail: 'onur.yesilyurt@medeniyet.edu.tr',
        isActive: true
    },
    {
        email: 'onur.yesilyurt@medeniyet.edu.tr',
        name: 'Onur Yeşilyurt',
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

export async function ensureDefaultMembers(db) {
    const membersCol = db.collection('members');
    const count = await membersCol.countDocuments();
    if (count === 0) {
        const now = new Date();
        await membersCol.insertMany(
            DEFAULT_LAB_MEMBERS.map(m => ({
                ...m,
                createdAt: now,
                updatedAt: now
            }))
        );
    }
}

export async function verifyUser(req) {
    const { user, status, error } = await verifyAuthWithStatus(req, 'pulsus');
    if (!user) {
        throw { status: status || 401, message: error || 'Authentication failed' };
    }

    const client = await clientPromise;
    const db = client.db(getDbName('Pulsus_db'));
    await ensureDefaultMembers(db);

    const membersCol = db.collection('members');
    const normalizedEmail = user.email.toLowerCase();
    let member = await membersCol.findOne({ email: normalizedEmail });

    const isAdmin = user.role === 'admin' || normalizedEmail === VET_EMAIL;

    if (!member) {
        const defaultProfile = resolveDefaultMemberProfile(normalizedEmail, user.name, isAdmin);
        const now = new Date();
        const newDoc = {
            ...defaultProfile,
            createdAt: now,
            updatedAt: now
        };
        await membersCol.insertOne(newDoc);
        member = newDoc;
    }

    const pulsusRole = isAdmin ? 'vet' : (member.pulsusRole || 'caretaker');
    const title = isAdmin
        ? (member.title || 'Sorumlu Veteriner Hekim')
        : (member.title || 'Hayvan Bakıcısı / Temizlik Görevlisi');

    return {
        ...user,
        name: member.name || user.name || user.email.split('@')[0],
        pulsusRole,
        title
    };
}
