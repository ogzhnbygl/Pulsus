import { verifyUser, ensureDefaultMembers } from '../lib/auth.js';
import clientPromise, { getDbName } from '../../lib/mongodb.js';
import { getMondayOfDate, distributeWeekPackage } from '../../lib/ritusEngine.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    let user;
    try {
        user = await verifyUser(req);
    } catch (error) {
        return res.status(error.status || 401).json({ error: error.message });
    }

    try {
        const client = await clientPromise;
        const db = client.db(getDbName('Pulsus_db'));
        await ensureDefaultMembers(db);

        const runsCol = db.collection('ritus_runs');
        const sequaCol = db.collection('sequa_tasks');
        const membersCol = db.collection('members');

        // Ensure current week has runs if database is fresh
        const currentWeekMonday = getMondayOfDate(new Date());
        const totalRunsCount = await runsCol.countDocuments({});
        if (totalRunsCount === 0) {
            await distributeWeekPackage(client, db, currentWeekMonday);
        }

        const runFilter = {};
        if (req.query?.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(req.query.weekStart)) {
            runFilter.weekStart = getMondayOfDate(req.query.weekStart);
        }

        const [members, runs, sequaTasks] = await Promise.all([
            membersCol.find({}).toArray(),
            runsCol.find(runFilter).sort({ scheduledDate: -1, scheduledTime: -1 }).toArray(),
            sequaCol.find({}).sort({ createdAt: -1 }).toArray()
        ]);

        const staffMap = new Map();
        for (const m of members) {
            const emailKey = m.email.toLowerCase();
            staffMap.set(emailKey, {
                email: emailKey,
                name: m.name,
                pulsusRole: m.pulsusRole,
                title: m.title,
                defaultBackupEmail: m.defaultBackupEmail || null,
                totalRitusAssigned: 0,
                ritusCompleted: 0,
                ritusInProgress: 0,
                ritusPendingReview: 0,
                ritusNeedsRevision: 0,
                totalRevisionsReceived: 0,
                escalatedCount: 0,
                delegatedOutByLeave: 0,
                delegatedInAsBackup: 0,
                reviewsPerformed: 0,
                sequaAssigned: 0,
                sequaCompleted: 0,
                issuesReported: 0,
                completionRate: 0,
                revisionRate: 0
            });
        }

        const ensureStaffEntry = email => {
            const key = String(email || '').trim().toLowerCase();
            if (!key) return null;
            if (!staffMap.has(key)) {
                staffMap.set(key, {
                    email: key,
                    name: key.split('@')[0],
                    pulsusRole: 'caretaker',
                    title: 'Personel',
                    defaultBackupEmail: null,
                    totalRitusAssigned: 0,
                    ritusCompleted: 0,
                    ritusInProgress: 0,
                    ritusPendingReview: 0,
                    ritusNeedsRevision: 0,
                    totalRevisionsReceived: 0,
                    escalatedCount: 0,
                    delegatedOutByLeave: 0,
                    delegatedInAsBackup: 0,
                    reviewsPerformed: 0,
                    sequaAssigned: 0,
                    sequaCompleted: 0,
                    issuesReported: 0,
                    completionRate: 0,
                    revisionRate: 0
                });
            }
            return staffMap.get(key);
        };

        let totalRuns = runs.length;
        let completedRuns = 0;
        let pendingReviewRuns = 0;
        let needsRevisionRuns = 0;
        let totalRevisions = 0;
        let totalEscalations = 0;
        let totalBackupHandovers = 0;
        let totalVetFallbacks = 0;

        for (const run of runs) {
            const effEntry = ensureStaffEntry(run.effectiveAssignee);
            if (effEntry) {
                effEntry.totalRitusAssigned++;
                if (run.status === 'done') effEntry.ritusCompleted++;
                if (run.status === 'in_progress') effEntry.ritusInProgress++;
                if (run.status === 'pending_review') effEntry.ritusPendingReview++;
                if (run.status === 'needs_revision') effEntry.ritusNeedsRevision++;
                if (run.revisionCount > 0) {
                    effEntry.totalRevisionsReceived += run.revisionCount;
                }
                if (run.status === 'escalated') {
                    effEntry.escalatedCount++;
                }
            }

            if (run.delegatedFrom) {
                const origEntry = ensureStaffEntry(run.delegatedFrom);
                if (origEntry) {
                    origEntry.delegatedOutByLeave++;
                }
                if (run.assignmentStatus === 'backup' && effEntry) {
                    effEntry.delegatedInAsBackup++;
                    totalBackupHandovers++;
                }
            }

            if (run.vetFallback) {
                totalVetFallbacks++;
            }

            if (run.status === 'done') {
                completedRuns++;
                const revEntry = ensureStaffEntry(run.approvedBy || run.effectiveReviewer);
                if (revEntry) {
                    revEntry.reviewsPerformed++;
                }
            }
            if (run.status === 'pending_review') pendingReviewRuns++;
            if (run.status === 'needs_revision') needsRevisionRuns++;
            if (run.revisionCount > 0) totalRevisions += run.revisionCount;
            if (run.status === 'escalated') totalEscalations++;
        }

        for (const task of sequaTasks) {
            const assignedEntry = ensureStaffEntry(task.assignedTo);
            if (assignedEntry) {
                assignedEntry.sequaAssigned++;
                if (task.status === 'done') {
                    assignedEntry.sequaCompleted++;
                }
            }

            if (task.taskType === 'issue_report' || task.taskType === 'vet_request') {
                const reporterEntry = ensureStaffEntry(task.createdBy);
                if (reporterEntry) {
                    reporterEntry.issuesReported++;
                }
            }
        }

        const rolePriority = { vet: 0, technician: 1, caretaker: 2 };
        const staffMetrics = Array.from(staffMap.values())
            .map(s => ({
                ...s,
                completionRate:
                    s.totalRitusAssigned > 0
                        ? Math.round((s.ritusCompleted / s.totalRitusAssigned) * 100)
                        : 0,
                revisionRate:
                    s.totalRitusAssigned > 0
                        ? Math.round((s.totalRevisionsReceived / s.totalRitusAssigned) * 100)
                        : 0
            }))
            .sort((a, b) => (rolePriority[a.pulsusRole] ?? 9) - (rolePriority[b.pulsusRole] ?? 9));

        const recentRevisionsAndEscalations = runs
            .filter(r => (r.revisionCount && r.revisionCount > 0) || r.status === 'escalated')
            .slice(0, 30)
            .map(r => ({
                _id: r._id,
                title: r.title,
                category: r.category,
                scheduledDate: r.scheduledDate,
                effectiveAssignee: r.effectiveAssignee,
                effectiveReviewer: r.effectiveReviewer,
                status: r.status,
                revisionCount: r.revisionCount || 0,
                lastRevisionNote: r.lastRevisionNote || null,
                escalationNote: r.escalationNote || null,
                reviewHistory: r.reviewHistory || [],
                spawnedSequaIds: r.spawnedSequaIds || []
            }));

        const externalTasks = sequaTasks
            .filter(t => t.taskType === 'external')
            .map(t => {
                const createdMs = t.createdAt ? new Date(t.createdAt).getTime() : null;
                const completedMs = t.completedAt ? new Date(t.completedAt).getTime() : null;
                const resolutionHours =
                    createdMs && completedMs
                        ? Math.max(1, Math.round((completedMs - createdMs) / (1000 * 60 * 60)))
                        : null;
                return {
                    _id: t._id,
                    title: t.title,
                    description: t.description,
                    externalUnit: t.externalUnit || 'Üniversite Birimi',
                    externalTicketNo: t.externalTicketNo || null,
                    priority: t.priority,
                    status: t.status,
                    assignedTo: t.assignedTo,
                    createdAt: t.createdAt,
                    completedAt: t.completedAt || null,
                    resolutionHours
                };
            });

        const summary = {
            totalRuns,
            completedRuns,
            pendingReviewRuns,
            needsRevisionRuns,
            completionRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
            revisionRate: totalRuns > 0 ? Math.round((totalRevisions / totalRuns) * 100) : 0,
            totalRevisions,
            totalEscalations,
            totalBackupHandovers,
            totalVetFallbacks,
            totalSequaTasks: sequaTasks.length,
            sequaCompleted: sequaTasks.filter(t => t.status === 'done').length,
            externalTasksTotal: externalTasks.length,
            externalTasksOpen: externalTasks.filter(t => t.status !== 'done').length,
            externalTasksDone: externalTasks.filter(t => t.status === 'done').length
        };

        return res.status(200).json({
            summary,
            staffMetrics,
            recentRevisionsAndEscalations,
            externalTasks,
            viewerRole: user.pulsusRole
        });
    } catch (error) {
        console.error('GET /api/reports error:', error);
        return res.status(500).json({ error: 'Rapor verileri oluşturulurken hata oluştu.' });
    }
}
