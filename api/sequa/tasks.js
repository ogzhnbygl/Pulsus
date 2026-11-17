import { verifyUser, ensureDefaultMembers, VET_EMAIL } from '../lib/auth.js';
import clientPromise, { getDbName } from '../../lib/mongodb.js';
import { isUserOnLeave, toDateKey } from '../../lib/assignmentResolver.js';
import { getTodayIstanbulDateStr } from '../../lib/ritusEngine.js';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const timeFieldSchema = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat HH:mm formatında olmalıdır.')
    .nullable()
    .optional()
    .or(z.literal(''));

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
    startTime: timeFieldSchema,
    endTime: timeFieldSchema,
    sourceRitusRunId: z.string().nullable().optional(),
    contextRef: contextRefSchema
});

const patchSequaSchema = z.object({
    id: z.string().min(1, 'Görev ID gereklidir.'),
    action: z
        .enum([
            'move_status',
            'revert_to_todo',
            'convert_to_task',
            'request_revision',
            'approve',
            'add_note',
            'reassign',
            'edit_task'
        ])
        .default('move_status'),
    title: z.string().min(2).max(180).optional(),
    description: z.string().max(1500).optional(),
    status: z.enum(['reported', 'todo', 'in_progress', 'review', 'done']).optional(),
    taskType: z.enum(['task', 'vet_request', 'issue_report', 'external']).optional(),
    assignedTo: z.string().email().nullable().optional().or(z.literal('')),
    reviewerEmail: z.string().email().nullable().optional().or(z.literal('')),
    externalUnit: z.string().max(150).nullable().optional(),
    externalTicketNo: z.string().max(80).nullable().optional(),
    dueDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitiş tarihi YYYY-MM-DD formatında olmalıdır.')
        .nullable()
        .optional()
        .or(z.literal('')),
    startTime: timeFieldSchema,
    endTime: timeFieldSchema,
    contextRef: contextRefSchema,
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
        reviewerEmail: 'kubra.celik@medeniyet.edu.tr',
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
    const metaCol = db.collection('system_meta');
    const seededDoc = await metaCol.findOne({ _id: 'sequa_tasks_seeded' });
    if (seededDoc?.seeded) {
        return;
    }

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

    await metaCol.updateOne(
        { _id: 'sequa_tasks_seeded' },
        { $set: { seeded: true, updatedAt: new Date() } },
        { upsert: true }
    );
}

/**
 * Item 3: Automatically resets started ('in_progress') Sequa tasks back to 'todo' (yapılmamış)
 * if they were not completed / sent to review by the end of the day they were started (or their dueDate).
 */
async function autoResetEndOfDayIncompleteSequaTasks(sequaCol) {
    try {
        const todayStr = getTodayIstanbulDateStr();
        const now = new Date();
        const inProgressTasks = await sequaCol
            .find({
                status: 'in_progress',
                taskType: { $ne: 'external' }
            })
            .toArray();

        for (const t of inProgressTasks) {
            const startedDay = toDateKey(t.startedAt || t.updatedAt || t.createdAt);
            const isPastStartedDay = startedDay && startedDay < todayStr;
            const isPastDueDate = t.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) && t.dueDate < todayStr;
            if (isPastStartedDay || isPastDueDate) {
                await sequaCol.updateOne(
                    { _id: t._id, status: 'in_progress' },
                    {
                        $set: {
                            status: 'todo',
                            startedAt: null,
                            incompleteAtDayEnd: true,
                            updatedAt: now
                        },
                        $push: {
                            activityLog: {
                                action: 'auto_day_end_incomplete_reset',
                                by: 'system',
                                byName: 'Sistem (Gün Sonu Otomasyonu)',
                                at: now,
                                note: 'Başlanan görev gün sonuna kadar tamamlanmadığı (onaya gönderilmediği) için yarıda kaldı ve tekrardan yapılmamış (Yapılacak) olarak atandı.'
                            }
                        }
                    }
                );
            }
        }
    } catch {
        // Ignore on cold boot or mock DBs
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

    // Item 8 Self-heal: Ensure reviewerEmail is the creator (or converter) when a Technician created/assigned a task for Vet
    try {
        const vetAssignedTasks = await sequaCol
            .find({
                assignedTo: VET_EMAIL.toLowerCase(),
                reviewerEmail: VET_EMAIL.toLowerCase(),
                createdBy: { $ne: VET_EMAIL.toLowerCase() }
            })
            .toArray();
        for (const vt of vetAssignedTasks) {
            const rightfulReviewer =
                vt.convertedBy ||
                (vt.createdByRole !== 'caretaker' && vt.createdBy ? vt.createdBy : null);
            if (rightfulReviewer && rightfulReviewer.toLowerCase() !== VET_EMAIL.toLowerCase()) {
                await sequaCol.updateOne(
                    { _id: vt._id },
                    { $set: { reviewerEmail: rightfulReviewer.toLowerCase() } }
                );
            }
        }
    } catch {
        // Silently skip if query fails during cold boot
    }

    if (req.method === 'GET') {
        try {
            await autoResetEndOfDayIncompleteSequaTasks(sequaCol);

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

        if (data.startTime && data.endTime && data.endTime < data.startTime) {
            return res.status(400).json({
                error: 'Bitiş saati başlangıç saatinden önce olamaz.'
            });
        }

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
                    : getTodayIstanbulDateStr();

            let effectiveAssignee = targetEmail;
            let delegatedFrom = null;
            let leaveDelegationNote = null;

            const scheduledTime = data.startTime || null;
            const leaveCheck = await isUserOnLeave(client, targetEmail, checkDateStr, scheduledTime);
            if (leaveCheck.onLeave && targetEmail !== VET_EMAIL) {
                const backupEmail = targetMember?.defaultBackupEmail?.toLowerCase();
                if (backupEmail && backupEmail !== targetEmail) {
                    const backupLeave = await isUserOnLeave(client, backupEmail, checkDateStr, scheduledTime);
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
            // Item 8: Kontrolcü (reviewerEmail) görevi oluşturan kişi olmalıdır (bakıcı hariç)
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
                startTime: data.startTime || null,
                endTime: data.endTime || null,
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

            // Validate source Ritus run existence before insertion if provided
            if (data.sourceRitusRunId) {
                if (!ObjectId.isValid(data.sourceRitusRunId)) {
                    return res.status(400).json({ error: 'Geçersiz kaynak Ritus görev ID formatı.' });
                }
                const targetRun = await db.collection('ritus_runs').findOne({
                    _id: new ObjectId(data.sourceRitusRunId)
                });
                if (!targetRun) {
                    return res.status(404).json({ error: 'Kaynak Ritus görev kaydı bulunamadı.' });
                }
            }

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

                const members = await membersCol.find({}).toArray();
                const memberMap = new Map(members.map(m => [m.email.toLowerCase(), m]));

                const newAssignee = data.assignedTo
                    ? data.assignedTo.trim().toLowerCase()
                    : existing.assignedTo;
                const targetMember = memberMap.get(newAssignee);
                const isTargetVet =
                    newAssignee === VET_EMAIL.toLowerCase() || targetMember?.pulsusRole === 'vet';
                const newTaskType =
                    data.taskType ||
                    (data.externalUnit ? 'external' : isTargetVet ? 'vet_request' : 'task');

                const updatePayload = {
                    taskType: newTaskType,
                    status: data.status || (newTaskType === 'external' ? 'in_progress' : 'todo'),
                    assignedTo: newAssignee,
                    assignedToRole: isTargetVet
                        ? 'vet'
                        : newTaskType === 'external'
                          ? 'external'
                          : targetMember?.pulsusRole || 'technician',
                    // Item 8 & 10: Kontrolcü (reviewerEmail) görevi açan / dönüştüren kişi olmalıdır
                    reviewerEmail: userEmail,
                    convertedBy: userEmail,
                    convertedByName: user.name,
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

            // 1b. revert_to_todo (Item 3: Unstart / release an in_progress task back to 'todo')
            if (data.action === 'revert_to_todo') {
                const isVet = userRole === 'vet' || user.role === 'admin' || user.role === 'vet';
                const isAssigned = existing.assignedTo?.toLowerCase() === userEmail;
                if (!isAssigned && !isVet) {
                    return res.status(403).json({
                        error: 'Başlanan görevi yalnızca görevi yürüten personel veya Veteriner Hekim geri bırakabilir.'
                    });
                }
                if (existing.status !== 'in_progress') {
                    return res.status(400).json({
                        error: 'Yalnızca işlemdeki (başlatılmış) görevler geri bırakılabilir.'
                    });
                }

                const logEntry = {
                    action: 'revert_to_todo',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note: data.note || 'Başlanan görev yarıda bırakılarak yapılacaklara geri alındı.'
                };

                await sequaCol.updateOne(
                    { _id: taskObjectId },
                    {
                        $set: {
                            status: 'todo',
                            startedAt: null,
                            updatedAt: now
                        },
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
                const isVet = userRole === 'vet' || user.role === 'admin' || user.role === 'vet';
                const isReviewer = existing.reviewerEmail?.toLowerCase() === userEmail;
                const isCreator =
                    existing.createdBy?.toLowerCase() === userEmail ||
                    existing.convertedBy?.toLowerCase() === userEmail;
                if (!isReviewer && !isCreator && !isVet) {
                    return res.status(403).json({
                        error: 'Yalnızca görevin kontrolcüsü (görevi oluşturan) veya Sorumlu Veteriner Hekim revizyon talep edebilir.'
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

                const isVet = userRole === 'vet' || user.role === 'admin' || user.role === 'vet';
                const isReviewer = existing.reviewerEmail?.toLowerCase() === userEmail;
                const isCreator =
                    existing.createdBy?.toLowerCase() === userEmail ||
                    existing.convertedBy?.toLowerCase() === userEmail;

                // Item 8: If Technician created the task and sent it to Vet, Technician is the reviewer/creator and CAN approve it when in 'review'!
                if (!isReviewer && !isCreator && !isVet) {
                    return res.status(403).json({
                        error: 'Yalnızca görevin Kontrolcüsü (Oluşturan) veya Sorumlu Veteriner Hekim görevi onaylayıp kapatabilir.'
                    });
                }

                if (existing.status === 'done') {
                    return res.status(400).json({
                        error: 'Tamamlanmış denetim görevi yeniden açılamaz.'
                    });
                }

                const canDirectCloseByVet =
                    isVet &&
                    (existing.taskType === 'vet_request' || existing.taskType === 'issue_report') &&
                    existing.reviewerEmail?.toLowerCase() === VET_EMAIL.toLowerCase();

                if (existing.status !== 'review' && !canDirectCloseByVet) {
                    return res.status(400).json({
                        error: 'Görev tamamlanmadan veya denetime sunulmadan doğrudan onaylanamaz.'
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

            // 5. edit_task (Item 1 & Item 4: Only task creator or Vet can edit, and NEVER when in 'review' or 'done')
            if (data.action === 'edit_task') {
                const isVet = userRole === 'vet' || user.role === 'admin' || user.role === 'vet';
                const isTech = userRole === 'technician' || user.role === 'technician';
                const isCreator =
                    existing.createdBy?.toLowerCase() === userEmail ||
                    existing.convertedBy?.toLowerCase() === userEmail;

                // Item 1: Onaya gönderilen ('review') veya onaylanmış ('done') görev şeffaflık gereği düzenlenemez!
                if (['review', 'done'].includes(existing.status)) {
                    return res.status(403).json({
                        error: 'Onaya gönderilmiş (Kontrolde) veya tamamlanmış bir görev şeffaflık gereği düzenlenemez.'
                    });
                }

                // Item 4: Verilen görevler sadece görevi veren kişi veya Vet. Hekim tarafından düzenlenebilir
                if (!isVet && !isCreator) {
                    return res.status(403).json({
                        error: 'Verilen görevler yalnızca görevi oluşturan kişi veya Sorumlu Veteriner Hekim tarafından düzenlenebilir.'
                    });
                }

                // If existing.status is not 'reported' or 'todo', restrict editing to 'vet' or 'admin'
                if (!['reported', 'todo'].includes(existing.status) && !isVet) {
                    return res.status(403).json({
                        error: 'Yalnızca bildirilmiş veya yapılacak aşamasındaki görevler düzenlenebilir. İlerlemiş görevleri yalnızca Veteriner Hekim düzenleyebilir.'
                    });
                }

                if (data.startTime && data.endTime && data.endTime < data.startTime) {
                    return res.status(400).json({
                        error: 'Bitiş saati başlangıç saatinden önce olamaz.'
                    });
                }

                // Restrict editing 'taskType', 'externalUnit', and 'externalTicketNo' to user.role === 'vet' or user.role === 'technician'
                const isEditingRestrictedFields =
                    data.taskType !== undefined ||
                    data.externalUnit !== undefined ||
                    data.externalTicketNo !== undefined;

                if (isEditingRestrictedFields && !isVet && !isTech) {
                    return res.status(403).json({
                        error: 'Görev türü ve harici birim bilgileri yalnızca Veteriner Hekim veya Tekniker tarafından düzenlenebilir.'
                    });
                }

                if (userRole === 'caretaker') {
                    if (data.priority === 'critical') {
                        return res.status(403).json({
                            error: 'Bu görevin durumunu veya detaylarını güncelleme yetkiniz bulunmamaktadır.'
                        });
                    }
                    if (data.assignedTo) {
                        const cleanTarget = data.assignedTo.trim().toLowerCase();
                        const targetMember = await membersCol.findOne({ email: cleanTarget });
                        const targetRole = targetMember?.pulsusRole || (cleanTarget === VET_EMAIL ? 'vet' : 'caretaker');
                        if (targetRole === 'caretaker') {
                            return res.status(403).json({
                                error: 'Bakıcı/Temizlik personeli diğer bir bakıcıya iş veya bildirim atayamaz; yalnızca Teknikere veya Veteriner Hekime bildirim açabilir.'
                            });
                        }
                    }
                }

                const editFields = { updatedAt: now };
                if (data.title !== undefined) editFields.title = data.title.trim();
                if (data.description !== undefined) editFields.description = data.description.trim();
                if (data.taskType !== undefined) editFields.taskType = data.taskType;
                if (data.priority !== undefined) editFields.priority = data.priority;
                if (data.assignedTo) {
                    editFields.assignedTo = data.assignedTo.trim().toLowerCase();
                }
                if (data.externalUnit !== undefined) {
                    editFields.externalUnit = data.externalUnit ? data.externalUnit.trim() : null;
                }
                if (data.externalTicketNo !== undefined) {
                    editFields.externalTicketNo = data.externalTicketNo ? data.externalTicketNo.trim() : null;
                }
                if (data.dueDate !== undefined) {
                    editFields.dueDate = data.dueDate || null;
                }
                if (data.startTime !== undefined) {
                    editFields.startTime = data.startTime || null;
                }
                if (data.endTime !== undefined) {
                    editFields.endTime = data.endTime || null;
                }
                if (data.contextRef !== undefined) {
                    editFields.contextRef = data.contextRef;
                }

                // Item 10: If an issue_report in 'reported' is edited into a 'task' or 'vet_request', transition to 'todo' so assignee can start it
                if (
                    existing.status === 'reported' &&
                    editFields.taskType &&
                    editFields.taskType !== 'issue_report'
                ) {
                    editFields.status = editFields.taskType === 'external' ? 'in_progress' : 'todo';
                    if (userRole !== 'caretaker') {
                        editFields.reviewerEmail = userEmail;
                        editFields.convertedBy = userEmail;
                    }
                }

                const logEntry = {
                    action: 'edit_task',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note: data.note || 'Görev detayları düzenlendi.'
                };

                await sequaCol.updateOne(
                    { _id: taskObjectId },
                    {
                        $set: editFields,
                        $push: { activityLog: logEntry }
                    }
                );

                const updated = await sequaCol.findOne({ _id: taskObjectId });
                return res.status(200).json({ task: updated });
            }

            // 6. move_status or add_note
            if (data.action === 'move_status') {
                if (existing.status === 'done') {
                    return res.status(400).json({
                        error: 'Tamamlanmış denetim görevi yeniden açılamaz.'
                    });
                }

                if (data.status) {
                    const ALLOWED_NEXT_STATUSES = {
                        reported: ['todo', 'in_progress'],
                        todo: ['in_progress'],
                        in_progress: ['review', 'todo'],
                        review: ['done', 'in_progress']
                    };

                    const allowedTargets = ALLOWED_NEXT_STATUSES[existing.status] || [];
                    if (!allowedTargets.includes(data.status)) {
                        return res.status(400).json({
                            error: `Geçersiz durum geçişi: '${existing.status}' durumundan '${data.status}' durumuna doğrudan geçilemez.`
                        });
                    }
                }
            }

            const isVet = userRole === 'vet' || user.role === 'admin' || user.role === 'vet';
            const isTech = userRole === 'technician' || user.role === 'technician';
            const isAssigned = existing.assignedTo?.toLowerCase() === userEmail;
            const isReviewer = existing.reviewerEmail?.toLowerCase() === userEmail;
            const isCreator =
                existing.createdBy?.toLowerCase() === userEmail ||
                existing.convertedBy?.toLowerCase() === userEmail;
            const isTaskAssignedToVet =
                existing.taskType === 'vet_request' ||
                existing.assignedTo?.toLowerCase() === VET_EMAIL.toLowerCase();

            // 1. Task assigned to Vet: Only Vet can execute ('in_progress', 'review', or revert to 'todo'),
            //    while Reviewer/Creator (e.g. Technician who created it) can review ('done') or add notes.
            if (isTaskAssignedToVet && !isVet) {
                const isReviewerActionOnReview =
                    existing.status === 'review' &&
                    (isReviewer || isCreator) &&
                    (data.status === 'done' || data.status === 'in_progress');
                const isAddNoteOnly = data.action === 'add_note' && !data.status;

                if (!isReviewerActionOnReview && !isAddNoteOnly) {
                    return res.status(403).json({
                        error: 'Veteriner Hekime atanmış olan görevler yalnızca Sorumlu Veteriner Hekim tarafından başlatılabilir ve yürütülebilir.'
                    });
                }
            }

            // 2. Specific status transition checks for tasks
            if (data.status === 'in_progress') {
                if (!isAssigned && !isVet) {
                    return res.status(403).json({
                        error: 'Yalnızca göreve atanmış sorumlu personel veya Veteriner Hekim bu görevi işleme alabilir (başlatabilir).'
                    });
                }
            }

            if (data.status === 'todo' && existing.status === 'in_progress') {
                if (!isAssigned && !isVet) {
                    return res.status(403).json({
                        error: 'Başlanan görevi yalnızca görevi yürüten personel veya Veteriner Hekim geri bırakabilir.'
                    });
                }
            }

            if (data.status === 'review') {
                if (!isAssigned && !isVet) {
                    return res.status(403).json({
                        error: 'Yalnızca görevi yürüten personel veya Veteriner Hekim görevi kontrole gönderebilir.'
                    });
                }
            }

            if (data.status === 'done') {
                if (userRole === 'caretaker') {
                    return res.status(403).json({
                        error: 'Bakıcı/Temizlik personeli görevi doğrudan tamamlandı (Onay) durumuna alamaz.'
                    });
                }
                if (!isReviewer && !isCreator && !isVet) {
                    return res.status(403).json({
                        error: 'Yalnızca Kontrolcü (Görevi Oluşturan) veya Sorumlu Veteriner Hekim görevi onaylayıp kapatabilir.'
                    });
                }
            }

            const isAuthorized = isVet || isAssigned || isReviewer || isCreator;
            if (!isAuthorized) {
                return res.status(403).json({
                    error: 'Bu görevin durumunu veya detaylarını güncelleme yetkiniz bulunmamaktadır.'
                });
            }

            if (userRole === 'caretaker') {
                if (!isAssigned && !isCreator) {
                    return res.status(403).json({
                        error: 'Bu görevin durumunu veya detaylarını güncelleme yetkiniz bulunmamaktadır.'
                    });
                }
                if (data.priority === 'critical') {
                    return res.status(403).json({
                        error: 'Bu görevin durumunu veya detaylarını güncelleme yetkiniz bulunmamaktadır.'
                    });
                }
                if (data.externalTicketNo !== undefined && !isAssigned && !isCreator) {
                    return res.status(403).json({
                        error: 'Bu görevin durumunu veya detaylarını güncelleme yetkiniz bulunmamaktadır.'
                    });
                }
            }

            if (data.externalUnit !== undefined || data.externalTicketNo !== undefined) {
                if (!isVet && !isTech) {
                    return res.status(403).json({
                        error: 'Dış birim bilgileri yalnızca Veteriner Hekim veya Tekniker tarafından güncellenebilir.'
                    });
                }
            }

            const setFields = { updatedAt: now };
            if (data.status) {
                setFields.status = data.status;
                if (data.status === 'in_progress') {
                    setFields.startedAt = existing.startedAt || now;
                    setFields.incompleteAtDayEnd = false;
                } else if (data.status === 'todo' && existing.status === 'in_progress') {
                    setFields.startedAt = null;
                }
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
                action: data.status === 'todo' && existing.status === 'in_progress' ? 'revert_to_todo' : data.action,
                by: userEmail,
                byName: user.name,
                at: now,
                note:
                    data.note ||
                    (data.status === 'todo' && existing.status === 'in_progress'
                        ? 'Başlanan görev yarıda bırakılarak yapılacaklara geri alındı.'
                        : data.status
                          ? `Durum '${data.status}' olarak güncellendi.`
                          : 'Not eklendi.')
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

    if (req.method === 'DELETE') {
        const targetId = req.body?.id || req.body?._id || req.query?.id;
        if (!targetId || !ObjectId.isValid(targetId)) {
            return res.status(400).json({ error: 'Geçerli bir görev ID gereklidir.' });
        }

        try {
            const taskObjectId = new ObjectId(targetId);
            const existing = await sequaCol.findOne({ _id: taskObjectId });
            if (!existing) {
                return res.status(404).json({ error: 'Sequa görevi bulunamadı.' });
            }

            const isVet = user.pulsusRole === 'vet' || user.role === 'admin' || user.role === 'vet';
            const isCreator =
                existing.createdBy?.toLowerCase() === user.email.toLowerCase() ||
                existing.convertedBy?.toLowerCase() === user.email.toLowerCase();

            if (!isVet) {
                if (!isCreator) {
                    return res.status(403).json({
                        error: 'Verilen görevler yalnızca görevi oluşturan personel veya Sorumlu Veteriner Hekim tarafından silinebilir.'
                    });
                }

                const isStatusAllowed = ['reported', 'todo'].includes(existing.status);
                const hasReviewOrClinicalActivity =
                    (existing.revisionCount && existing.revisionCount > 0) ||
                    Boolean(existing.completedAt) ||
                    Boolean(existing.lastRevisionNote) ||
                    (Array.isArray(existing.activityLog) &&
                        existing.activityLog.some(log => {
                            if (['created', 'created_from_ritus_escalation', 'convert_to_task'].includes(log.action)) {
                                return false;
                            }
                            if (['request_revision', 'approve'].includes(log.action)) {
                                return true;
                            }
                            return (
                                log.by &&
                                log.by.toLowerCase() !== existing.createdBy?.toLowerCase() &&
                                log.by.toLowerCase() !== existing.convertedBy?.toLowerCase()
                            );
                        }));

                if (!isStatusAllowed || hasReviewOrClinicalActivity) {
                    return res.status(403).json({
                        error: 'İşleme alınmış, denetim veya klinik değerlendirme görmüş görevler yalnızca Veteriner Hekim tarafından silinebilir.'
                    });
                }
            }

            await db.collection('system_meta').updateOne(
                { _id: 'sequa_tasks_seeded' },
                { $set: { seeded: true, updatedAt: new Date() } },
                { upsert: true }
            );

            await sequaCol.deleteOne({ _id: taskObjectId });
            return res.status(200).json({ success: true, deletedId: targetId });
        } catch (error) {
            console.error('DELETE /api/sequa/tasks error:', error);
            return res.status(500).json({ error: 'Sequa görevi silinirken hata oluştu.' });
        }
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
}
