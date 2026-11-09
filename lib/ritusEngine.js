import { getDbName } from './mongodb.js';
import { resolveTaskAssignment, DEFAULT_VET_EMAIL } from './assignmentResolver.js';

/**
 * Given any Date or 'YYYY-MM-DD' string, returns the Monday ('YYYY-MM-DD') of that week.
 */
export function getMondayOfDate(input = new Date()) {
    let d;
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input.trim())) {
        const [y, m, day] = input.trim().slice(0, 10).split('-').map(Number);
        d = new Date(Date.UTC(y, m - 1, day));
    } else {
        const raw = input instanceof Date ? input : new Date(input);
        d = new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()));
    }

    const utcDay = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
    d.setUTCDate(d.getUTCDate() + diffToMonday);
    return d.toISOString().slice(0, 10);
}

/**
 * Adds `days` to a 'YYYY-MM-DD' string and returns 'YYYY-MM-DD'.
 */
export function addDays(dateStr, days) {
    const [y, m, day] = dateStr.slice(0, 10).split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, day));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/**
 * Returns the 7 days (Monday..Sunday) for a given weekStart Monday ('YYYY-MM-DD').
 */
export function getWeekDays(weekStartMondayStr) {
    const mondayStr = getMondayOfDate(weekStartMondayStr);
    const days = [];
    for (let i = 0; i < 7; i++) {
        const dateStr = addDays(mondayStr, i);
        const [year, month, dayOfMonth] = dateStr.split('-').map(Number);
        const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        days.push({
            dateStr,
            dayIndex: i + 1, // 1 = Monday .. 7 = Sunday
            year,
            month, // 1..12
            dayOfMonth, // 1..31
            lastDayOfMonth
        });
    }
    return days;
}

/**
 * Checks if a reference Date is at or after Friday 16:30 (local/Turkey time or server time) of its week.
 */
export function isFridayDistributionTimeReached(referenceTime = new Date()) {
    const d = referenceTime instanceof Date ? referenceTime : new Date(referenceTime);
    if (Number.isNaN(d.getTime())) return false;
    const day = d.getDay(); // 0=Sun, 5=Fri, 6=Sat
    if (day === 6 || day === 0) return true;
    if (day === 5) {
        const minutes = d.getHours() * 60 + d.getMinutes();
        return minutes >= 16 * 60 + 30; // 16:30
    }
    return false;
}

/**
 * Determines if a Ritus template should generate a run on a specific calendar day of the target week.
 * Handles mid-week month transitions (e.g., Wednesday is the 1st of a new month) and quarterly transitions seamlessly.
 */
export function doesTemplateMatchDay(template, dayObj) {
    if (!template || template.isActive === false) return false;

    const freq = template.frequency || 'weekly';
    const daysOfWeek = Array.isArray(template.daysOfWeek) ? template.daysOfWeek.map(Number) : [];
    const targetDayOfMonth = template.dayOfMonth ? Number(template.dayOfMonth) : null;

    if (freq === 'weekly') {
        return daysOfWeek.includes(dayObj.dayIndex);
    }

    if (freq === 'monthly') {
        if (targetDayOfMonth !== null && targetDayOfMonth >= 1 && targetDayOfMonth <= 31) {
            const effectiveDay = Math.min(targetDayOfMonth, dayObj.lastDayOfMonth);
            return dayObj.dayOfMonth === effectiveDay;
        }
        if (daysOfWeek.length > 0) {
            // First occurrence of daysOfWeek[0] in the new month (falls within days 1..7 of the month)
            return dayObj.dayIndex === daysOfWeek[0] && dayObj.dayOfMonth <= 7;
        }
        return dayObj.dayOfMonth === 1;
    }

    if (freq === 'quarterly') {
        const monthsOfQuarter =
            Array.isArray(template.monthsOfQuarter) && template.monthsOfQuarter.length > 0
                ? template.monthsOfQuarter.map(Number)
                : [1, 4, 7, 10];

        if (!monthsOfQuarter.includes(dayObj.month)) {
            return false;
        }

        if (targetDayOfMonth !== null && targetDayOfMonth >= 1 && targetDayOfMonth <= 31) {
            const effectiveDay = Math.min(targetDayOfMonth, dayObj.lastDayOfMonth);
            return dayObj.dayOfMonth === effectiveDay;
        }
        if (daysOfWeek.length > 0) {
            return dayObj.dayIndex === daysOfWeek[0] && dayObj.dayOfMonth <= 7;
        }
        return dayObj.dayOfMonth === 1;
    }

    return false;
}

export const DEFAULT_RITUS_TEMPLATES = [
    {
        title: 'Fare Odaları Sabah Yem & Su Kontrolü',
        description: 'IVC raflarındaki sulukların doluluk, sızdırmazlık ve yemlik seviyelerinin kontrolü.',
        category: 'feeding',
        frequency: 'weekly',
        daysOfWeek: [1, 2, 3, 4, 5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '08:30',
        primaryAssignee: 'gokhan.sert@medeniyet.edu.tr',
        backupAssignee: 'yusufenes.isik@medeniyet.edu.tr',
        primaryReviewer: 'kubra.celik@medeniyet.edu.tr',
        backupReviewer: 'gamze.demir@medeniyet.edu.tr',
        checklist: [
            'Oda 1 ve Oda 2 IVC suluk seviyeleri kontrol edildi',
            'Yem eksikleri otoklavlanmış yem ile tamamlandı',
            'Sızdıran veya tıkanan nipeller ayrıldı',
            'Oda sıcaklık ve nem değerleri forma işlendi'
        ],
        contextRef: { module: 'Locus', entityType: 'room', entityId: 'FARE-1', label: 'Fare Üretim & Deney Odaları' },
        isActive: true
    },
    {
        title: 'Sıçan Odaları Kafes & Altlık Değişimi',
        description: 'Kirli kafeslerin temiz otoklavlı kafeslerle değişimi ve yıkama ünitesine transferi.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1, 4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '10:00',
        primaryAssignee: 'yusufenes.isik@medeniyet.edu.tr',
        backupAssignee: 'gokhan.sert@medeniyet.edu.tr',
        primaryReviewer: 'gamze.demir@medeniyet.edu.tr',
        backupReviewer: 'kubra.celik@medeniyet.edu.tr',
        checklist: [
            'Kirli kafesler biyogüvenlik kabini altında değiştirildi',
            'Hayvanlar yeni kafeslere kuyruk/refah kuralına uygun aktarıldı',
            'Kafes kartları eksiksiz taşındı',
            'Kirli kafesler yıkama odasına teslim edildi'
        ],
        contextRef: { module: 'Locus', entityType: 'room', entityId: 'SICAN-1', label: 'Sıçan Barındırma Odası' },
        isActive: true
    },
    {
        title: 'Yıkama Ünitesi & Koridor Dezenfeksiyonu',
        description: 'Temiz ve kirli koridor zeminlerinin virkon/dezenfektan ile paspaslanması ve atık tahliyesi.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [2, 5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '14:00',
        primaryAssignee: 'gokhan.sert@medeniyet.edu.tr',
        backupAssignee: 'yusufenes.isik@medeniyet.edu.tr',
        primaryReviewer: 'kubra.celik@medeniyet.edu.tr',
        backupReviewer: 'gamze.demir@medeniyet.edu.tr',
        checklist: [
            'Kirli koridor zemin dezenfeksiyonu yapıldı',
            'Tıbbi ve evsel atık kutuları mühürlenip tahliye edildi',
            'Ayak paspasları dezenfektan solüsyonu yenilendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Biyogüvenlik Kabini & Otoklav Haftalık Performans Testi',
        description: 'Biyolojik indikatör ve Bowie-Dick testlerinin uygulanması ve kayıt altına alınması.',
        category: 'calibration',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '11:00',
        primaryAssignee: 'kubra.celik@medeniyet.edu.tr',
        backupAssignee: 'gamze.demir@medeniyet.edu.tr',
        primaryReviewer: 'oguzhan.baygul@medeniyet.edu.tr',
        backupReviewer: null,
        checklist: [
            'Otoklav Bowie-Dick testi uygulandı ve renk değişimi doğrulandı',
            'Biyogüvenlik kabini UV ve hava akış alarm kontrolü yapıldı',
            'Test çıktıları cihaz defterine arşivlendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Aylık İlaç, Anestezik & Sarf Malzeme SKT Denetimi',
        description: 'Silo envanterindeki anestezik, analjezik ve sarf malzemelerin miat ve soğuk zincir kontrolü.',
        category: 'health',
        frequency: 'monthly',
        daysOfWeek: [],
        dayOfMonth: 15,
        monthsOfQuarter: [],
        scheduledTime: '13:30',
        primaryAssignee: 'gamze.demir@medeniyet.edu.tr',
        backupAssignee: 'kubra.celik@medeniyet.edu.tr',
        primaryReviewer: 'oguzhan.baygul@medeniyet.edu.tr',
        backupReviewer: null,
        checklist: [
            'Narkotik ve anestezik dolabı stok sayımı yapıldı',
            'Son kullanma tarihi yaklaşan (<60 gün) ürünler işaretlendi',
            'Buzdolabı (+4°C) sıcaklık logları kontrol edildi'
        ],
        contextRef: { module: 'Silo', entityType: 'inventory', entityId: 'MED-STOCK', label: 'Tıbbi Sarf & İlaç Dolabı' },
        isActive: true
    },
    {
        title: 'Çeyreklik Sentinel Hayvan Seroloji & Mikrobiyolojik Tarama',
        description: 'FELASA rehberine uygun olarak sentinel kafeslerinden örnek alımı ve sağlık taraması.',
        category: 'health',
        frequency: 'quarterly',
        daysOfWeek: [],
        dayOfMonth: 10,
        monthsOfQuarter: [1, 4, 7, 10],
        scheduledTime: '09:30',
        primaryAssignee: 'kubra.celik@medeniyet.edu.tr',
        backupAssignee: 'gamze.demir@medeniyet.edu.tr',
        primaryReviewer: 'oguzhan.baygul@medeniyet.edu.tr',
        backupReviewer: null,
        checklist: [
            'Sentinel kafeslerinden kan ve sürüntü örnekleri alındı',
            'Ektoparazit ve endoparazit muayenesi yapıldı',
            'Sonuçlar Veteriner Hekim onayına sunuldu'
        ],
        contextRef: null,
        isActive: true
    }
];

export async function ensureDefaultRitusTemplates(db) {
    const metaCol = db.collection('system_meta');
    const seededDoc = await metaCol.findOne({ _id: 'ritus_templates_seeded' });
    if (seededDoc?.seeded) {
        return;
    }

    const col = db.collection('ritus_templates');
    const count = await col.countDocuments();
    if (count === 0) {
        const now = new Date();
        await col.insertMany(
            DEFAULT_RITUS_TEMPLATES.map(t => ({
                ...t,
                createdBy: DEFAULT_VET_EMAIL,
                createdAt: now,
                updatedAt: now
            }))
        );
    }

    await metaCol.updateOne(
        { _id: 'ritus_templates_seeded' },
        { $set: { seeded: true, updatedAt: new Date() } },
        { upsert: true }
    );
}

/**
 * Distributes Ritus task runs for `weekStartMondayStr` ('YYYY-MM-DD').
 * Idempotent: will not duplicate runs that already exist for `{ templateId, scheduledDate }`.
 */
export async function distributeWeekPackage(client, db, weekStartMondayStr, options = {}) {
    await ensureDefaultRitusTemplates(db);

    const weekStart = getMondayOfDate(weekStartMondayStr);
    const weekDays = getWeekDays(weekStart);

    const templatesCol = db.collection('ritus_templates');
    const runsCol = db.collection('ritus_runs');

    const query = options.templateId
        ? { _id: options.templateId, isActive: { $ne: false } }
        : { isActive: { $ne: false } };

    const templates = await templatesCol.find(query).toArray();

    const circaDb = client.db(getDbName('Circa_db'));
    const approvedLeaves = await circaDb
        .collection('time_offs')
        .find({ status: 'approved' })
        .toArray();

    const createdRuns = [];
    let existingCount = 0;
    const now = new Date();

    for (const template of templates) {
        const templateIdStr = template._id.toString();

        for (const dayObj of weekDays) {
            if (!doesTemplateMatchDay(template, dayObj)) {
                continue;
            }

            const existing = await runsCol.findOne({
                templateId: templateIdStr,
                scheduledDate: dayObj.dateStr
            });

            if (existing) {
                existingCount++;
                continue;
            }

            const assignment = await resolveTaskAssignment(client, {
                primaryAssignee: template.primaryAssignee,
                backupAssignee: template.backupAssignee || null,
                primaryReviewer: template.primaryReviewer,
                backupReviewer: template.backupReviewer || null,
                vetEmail: DEFAULT_VET_EMAIL,
                dateStr: dayObj.dateStr,
                scheduledTime: template.scheduledTime || null,
                preloadedLeaves: approvedLeaves
            });

            const checklistItems = Array.isArray(template.checklist)
                ? template.checklist.map((text, idx) => ({
                      id: idx,
                      text: String(text),
                      done: false
                  }))
                : [];

            const newRun = {
                templateId: templateIdStr,
                title: template.title,
                description: template.description || '',
                category: template.category || 'other',
                frequency: template.frequency || 'weekly',
                weekStart,
                scheduledDate: dayObj.dateStr,
                scheduledTime: template.scheduledTime || '09:00',
                primaryAssignee: assignment.primaryAssignee,
                backupAssignee: assignment.backupAssignee,
                effectiveAssignee: assignment.effectiveAssignee,
                assignmentStatus: assignment.assignmentStatus,
                delegatedFrom: assignment.delegatedFrom,
                vetFallback: assignment.vetFallback,
                assigneeLeaveInfo: assignment.assigneeLeaveInfo,
                primaryReviewer: assignment.primaryReviewer,
                backupReviewer: assignment.backupReviewer,
                effectiveReviewer: assignment.effectiveReviewer,
                reviewerStatus: assignment.reviewerStatus,
                reviewerDelegatedFrom: assignment.reviewerDelegatedFrom,
                reviewerVetFallback: assignment.reviewerVetFallback,
                reviewerLeaveInfo: assignment.reviewerLeaveInfo,
                status: 'todo',
                checklist: checklistItems,
                revisionCount: 0,
                reviewHistory: [],
                spawnedSequaIds: [],
                contextRef: template.contextRef || null,
                reassignedByVet: false,
                distributedAt: now,
                updatedAt: now
            };

            const insertResult = await runsCol.insertOne(newRun);
            createdRuns.push({ ...newRun, _id: insertResult.insertedId });
        }
    }

    return {
        weekStart,
        createdCount: createdRuns.length,
        existingCount,
        createdRuns
    };
}

/**
 * Synchronizes a single template's changes immediately to `currentWeekStartStr` runs
 * when the Veterinarian chooses `updateScope === 'current_week'`.
 */
export async function syncTemplateToCurrentWeekRuns(client, db, templateDoc, currentWeekStartStr) {
    const weekStart = getMondayOfDate(currentWeekStartStr);
    const weekDays = getWeekDays(weekStart);
    const runsCol = db.collection('ritus_runs');
    const templateIdStr = templateDoc._id.toString();

    const circaDb = client.db(getDbName('Circa_db'));
    const approvedLeaves = await circaDb
        .collection('time_offs')
        .find({ status: 'approved' })
        .toArray();

    let affectedCount = 0;
    const now = new Date();

    // If template was deactivated, remove unstarted 'todo' runs for the current week
    if (templateDoc.isActive === false) {
        const delRes = await runsCol.deleteMany({
            templateId: templateIdStr,
            weekStart,
            status: 'todo'
        });
        return delRes.deletedCount || 0;
    }

    const matchedDates = new Set();

    for (const dayObj of weekDays) {
        if (!doesTemplateMatchDay(templateDoc, dayObj)) {
            continue;
        }
        matchedDates.add(dayObj.dateStr);

        const assignment = await resolveTaskAssignment(client, {
            primaryAssignee: templateDoc.primaryAssignee,
            backupAssignee: templateDoc.backupAssignee || null,
            primaryReviewer: templateDoc.primaryReviewer,
            backupReviewer: templateDoc.backupReviewer || null,
            vetEmail: DEFAULT_VET_EMAIL,
            dateStr: dayObj.dateStr,
            scheduledTime: templateDoc.scheduledTime || null,
            preloadedLeaves: approvedLeaves
        });

        const existingRun = await runsCol.findOne({
            templateId: templateIdStr,
            scheduledDate: dayObj.dateStr
        });

        if (existingRun) {
            if (['todo', 'in_progress', 'needs_revision'].includes(existingRun.status)) {
                const updatePayload = {
                    title: templateDoc.title,
                    description: templateDoc.description || '',
                    category: templateDoc.category || 'other',
                    frequency: templateDoc.frequency || 'weekly',
                    scheduledTime: templateDoc.scheduledTime || '09:00',
                    primaryAssignee: assignment.primaryAssignee,
                    backupAssignee: assignment.backupAssignee,
                    effectiveAssignee: assignment.effectiveAssignee,
                    assignmentStatus: assignment.assignmentStatus,
                    delegatedFrom: assignment.delegatedFrom,
                    vetFallback: assignment.vetFallback,
                    assigneeLeaveInfo: assignment.assigneeLeaveInfo,
                    primaryReviewer: assignment.primaryReviewer,
                    backupReviewer: assignment.backupReviewer,
                    effectiveReviewer: assignment.effectiveReviewer,
                    reviewerStatus: assignment.reviewerStatus,
                    reviewerDelegatedFrom: assignment.reviewerDelegatedFrom,
                    reviewerVetFallback: assignment.reviewerVetFallback,
                    reviewerLeaveInfo: assignment.reviewerLeaveInfo,
                    contextRef: templateDoc.contextRef || null,
                    updatedAt: now
                };

                if (existingRun.status === 'todo' && Array.isArray(templateDoc.checklist)) {
                    updatePayload.checklist = templateDoc.checklist.map((text, idx) => ({
                        id: idx,
                        text: String(text),
                        done: false
                    }));
                }

                await runsCol.updateOne({ _id: existingRun._id }, { $set: updatePayload });
                affectedCount++;
            }
        } else {
            const checklistItems = Array.isArray(templateDoc.checklist)
                ? templateDoc.checklist.map((text, idx) => ({
                      id: idx,
                      text: String(text),
                      done: false
                  }))
                : [];

            await runsCol.insertOne({
                templateId: templateIdStr,
                title: templateDoc.title,
                description: templateDoc.description || '',
                category: templateDoc.category || 'other',
                frequency: templateDoc.frequency || 'weekly',
                weekStart,
                scheduledDate: dayObj.dateStr,
                scheduledTime: templateDoc.scheduledTime || '09:00',
                primaryAssignee: assignment.primaryAssignee,
                backupAssignee: assignment.backupAssignee,
                effectiveAssignee: assignment.effectiveAssignee,
                assignmentStatus: assignment.assignmentStatus,
                delegatedFrom: assignment.delegatedFrom,
                vetFallback: assignment.vetFallback,
                assigneeLeaveInfo: assignment.assigneeLeaveInfo,
                primaryReviewer: assignment.primaryReviewer,
                backupReviewer: assignment.backupReviewer,
                effectiveReviewer: assignment.effectiveReviewer,
                reviewerStatus: assignment.reviewerStatus,
                reviewerDelegatedFrom: assignment.reviewerDelegatedFrom,
                reviewerVetFallback: assignment.reviewerVetFallback,
                reviewerLeaveInfo: assignment.reviewerLeaveInfo,
                status: 'todo',
                checklist: checklistItems,
                revisionCount: 0,
                reviewHistory: [],
                spawnedSequaIds: [],
                contextRef: templateDoc.contextRef || null,
                reassignedByVet: false,
                distributedAt: now,
                updatedAt: now
            });
            affectedCount++;
        }
    }

    // Remove unstarted 'todo' runs in this week whose scheduledDate is no longer part of the template
    const obsoleteRes = await runsCol.deleteMany({
        templateId: templateIdStr,
        weekStart,
        status: 'todo',
        scheduledDate: { $nin: Array.from(matchedDates) }
    });
    affectedCount += obsoleteRes.deletedCount || 0;

    return affectedCount;
}

/**
 * Re-evaluates Circa_db approved leaves for all unstarted ('todo') runs in `weekStart` (or all 'todo' runs)
 * so newly approved leaves in Circa automatically activate backup staff or Vet fallback.
 */
export async function syncPendingRunsWithCircaLeaves(client, db, weekStart = null) {
    const runsCol = db.collection('ritus_runs');
    const filter = {
        status: 'todo',
        reassignedByVet: { $ne: true }
    };
    if (weekStart) {
        filter.weekStart = getMondayOfDate(weekStart);
    }

    const todoRuns = await runsCol.find(filter).toArray();
    if (todoRuns.length === 0) return 0;

    const circaDb = client.db(getDbName('Circa_db'));
    const approvedLeaves = await circaDb
        .collection('time_offs')
        .find({ status: 'approved' })
        .toArray();

    let updatedCount = 0;
    const now = new Date();

    for (const run of todoRuns) {
        const resolved = await resolveTaskAssignment(client, {
            primaryAssignee: run.primaryAssignee,
            backupAssignee: run.backupAssignee || null,
            primaryReviewer: run.primaryReviewer,
            backupReviewer: run.backupReviewer || null,
            vetEmail: DEFAULT_VET_EMAIL,
            dateStr: run.scheduledDate,
            scheduledTime: run.scheduledTime || null,
            preloadedLeaves: approvedLeaves
        });

        const changed =
            resolved.effectiveAssignee !== run.effectiveAssignee ||
            resolved.assignmentStatus !== run.assignmentStatus ||
            resolved.effectiveReviewer !== run.effectiveReviewer ||
            resolved.reviewerStatus !== run.reviewerStatus ||
            resolved.vetFallback !== run.vetFallback ||
            resolved.reviewerVetFallback !== run.reviewerVetFallback;

        if (changed) {
            await runsCol.updateOne(
                { _id: run._id },
                {
                    $set: {
                        effectiveAssignee: resolved.effectiveAssignee,
                        assignmentStatus: resolved.assignmentStatus,
                        delegatedFrom: resolved.delegatedFrom,
                        vetFallback: resolved.vetFallback,
                        assigneeLeaveInfo: resolved.assigneeLeaveInfo,
                        effectiveReviewer: resolved.effectiveReviewer,
                        reviewerStatus: resolved.reviewerStatus,
                        reviewerDelegatedFrom: resolved.reviewerDelegatedFrom,
                        reviewerVetFallback: resolved.reviewerVetFallback,
                        reviewerLeaveInfo: resolved.reviewerLeaveInfo,
                        updatedAt: now
                    }
                }
            );
            updatedCount++;
        }
    }

    return updatedCount;
}
