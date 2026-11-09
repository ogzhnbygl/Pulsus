import { getDbName } from './mongodb.js';

export const DEFAULT_VET_EMAIL = 'oguzhan.baygul@medeniyet.edu.tr';

/**
 * Formats a Date object or date string into 'YYYY-MM-DD'
 */
export function toDateKey(val) {
    if (!val) return null;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            return trimmed.slice(0, 10);
        }
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString().slice(0, 10);
        }
        return null;
    }
    if (val instanceof Date && !Number.isNaN(val.getTime())) {
        return val.toISOString().slice(0, 10);
    }
    return null;
}

/**
 * Converts a Date or 'YYYY-MM-DD' string into local/UTC date keys so neither timezone offset misses a match
 */
function matchesDateStr(rawDateVal, targetDateStr) {
    if (!rawDateVal || !targetDateStr) return false;
    const normalizedTarget = targetDateStr.slice(0, 10);

    if (typeof rawDateVal === 'string') {
        if (rawDateVal.slice(0, 10) === normalizedTarget) return true;
        const d = new Date(rawDateVal);
        if (!Number.isNaN(d.getTime())) {
            if (d.toISOString().slice(0, 10) === normalizedTarget) return true;
            const localKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (localKey === normalizedTarget) return true;
        }
        return false;
    }

    if (rawDateVal instanceof Date && !Number.isNaN(rawDateVal.getTime())) {
        if (rawDateVal.toISOString().slice(0, 10) === normalizedTarget) return true;
        const localKey = `${rawDateVal.getFullYear()}-${String(rawDateVal.getMonth() + 1).padStart(2, '0')}-${String(rawDateVal.getDate()).padStart(2, '0')}`;
        if (localKey === normalizedTarget) return true;
    }

    return false;
}

function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Checks whether a single approved time-off record from Circa_db covers dateStr (+ optional scheduledTime).
 */
export function doesLeaveMatchDateAndTime(leaveDoc, dateStr, scheduledTime = null) {
    if (!leaveDoc || leaveDoc.status !== 'approved') return false;

    if (leaveDoc.unit === 'daily') {
        const dates = Array.isArray(leaveDoc.dates) ? leaveDoc.dates : [];
        return dates.some(d => matchesDateStr(d, dateStr));
    }

    if (leaveDoc.unit === 'hourly') {
        if (!matchesDateStr(leaveDoc.singleDate, dateStr)) return false;

        if (!scheduledTime) {
            return true;
        }

        const schedMin = timeToMinutes(scheduledTime);
        const startMin = timeToMinutes(leaveDoc.startTime);
        const endMin = timeToMinutes(leaveDoc.endTime);

        if (schedMin === null || startMin === null || endMin === null) {
            return true;
        }

        return startMin <= schedMin && schedMin <= endMin;
    }

    return false;
}

/**
 * Checks if `email` has an approved leave in `Circa_db.time_offs` on `dateStr` (and `scheduledTime`).
 */
export async function isUserOnLeave(client, email, dateStr, scheduledTime = null, preloadedLeaves = null) {
    if (!email || !dateStr) {
        return { onLeave: false, leaveInfo: null };
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    let approvedLeaves = preloadedLeaves;

    if (!approvedLeaves) {
        const circaDb = client.db(getDbName('Circa_db'));
        approvedLeaves = await circaDb
            .collection('time_offs')
            .find({
                email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                status: 'approved'
            })
            .toArray();
    } else {
        approvedLeaves = approvedLeaves.filter(
            l => String(l.email || '').trim().toLowerCase() === normalizedEmail && l.status === 'approved'
        );
    }

    for (const doc of approvedLeaves) {
        if (doesLeaveMatchDateAndTime(doc, dateStr, scheduledTime)) {
            return {
                onLeave: true,
                leaveInfo: {
                    unit: doc.unit,
                    startTime: doc.startTime || null,
                    endTime: doc.endTime || null,
                    description: doc.description || ''
                }
            };
        }
    }

    return { onLeave: false, leaveInfo: null };
}

/**
 * Resolves both effectiveAssignee and effectiveReviewer using the 3-tier chain:
 * Primary -> Backup -> Veterinarian Fallback (never unassigned).
 */
export async function resolveTaskAssignment(
    client,
    {
        primaryAssignee,
        backupAssignee = null,
        primaryReviewer,
        backupReviewer = null,
        vetEmail = DEFAULT_VET_EMAIL,
        dateStr,
        scheduledTime = null,
        preloadedLeaves = null
    }
) {
    const cleanPrimaryAssignee = primaryAssignee ? String(primaryAssignee).trim().toLowerCase() : vetEmail;
    const cleanBackupAssignee = backupAssignee ? String(backupAssignee).trim().toLowerCase() : null;
    const cleanPrimaryReviewer = primaryReviewer ? String(primaryReviewer).trim().toLowerCase() : vetEmail;
    const cleanBackupReviewer = backupReviewer ? String(backupReviewer).trim().toLowerCase() : null;
    const cleanVetEmail = (vetEmail || DEFAULT_VET_EMAIL).trim().toLowerCase();

    // Preload all approved leaves once if not provided
    let leavesPool = preloadedLeaves;
    if (!leavesPool) {
        const circaDb = client.db(getDbName('Circa_db'));
        leavesPool = await circaDb
            .collection('time_offs')
            .find({ status: 'approved' })
            .toArray();
    }

    // 1. Assignee Chain (Asil -> Yedek -> Veteriner Hekim)
    let effectiveAssignee = cleanPrimaryAssignee;
    let assignmentStatus = 'primary';
    let delegatedFrom = null;
    let vetFallback = false;
    let assigneeLeaveInfo = null;

    const primaryAssigneeLeave = await isUserOnLeave(
        client,
        cleanPrimaryAssignee,
        dateStr,
        scheduledTime,
        leavesPool
    );

    if (primaryAssigneeLeave.onLeave) {
        assigneeLeaveInfo = primaryAssigneeLeave.leaveInfo;
        if (cleanBackupAssignee && cleanBackupAssignee !== cleanPrimaryAssignee) {
            const backupAssigneeLeave = await isUserOnLeave(
                client,
                cleanBackupAssignee,
                dateStr,
                scheduledTime,
                leavesPool
            );
            if (!backupAssigneeLeave.onLeave) {
                effectiveAssignee = cleanBackupAssignee;
                assignmentStatus = 'backup';
                delegatedFrom = cleanPrimaryAssignee;
                vetFallback = false;
            } else {
                effectiveAssignee = cleanVetEmail;
                assignmentStatus = 'vet_fallback';
                delegatedFrom = cleanPrimaryAssignee;
                vetFallback = true;
            }
        } else {
            effectiveAssignee = cleanVetEmail;
            assignmentStatus = 'vet_fallback';
            delegatedFrom = cleanPrimaryAssignee;
            vetFallback = true;
        }
    }

    // 2. Reviewer Chain (Asil Denetçi -> Yedek Denetçi -> Veteriner Hekim)
    let effectiveReviewer = cleanPrimaryReviewer;
    let reviewerStatus = 'primary';
    let reviewerDelegatedFrom = null;
    let reviewerVetFallback = false;
    let reviewerLeaveInfo = null;

    const primaryReviewerLeave = await isUserOnLeave(
        client,
        cleanPrimaryReviewer,
        dateStr,
        scheduledTime,
        leavesPool
    );

    if (primaryReviewerLeave.onLeave) {
        reviewerLeaveInfo = primaryReviewerLeave.leaveInfo;
        if (cleanBackupReviewer && cleanBackupReviewer !== cleanPrimaryReviewer) {
            const backupReviewerLeave = await isUserOnLeave(
                client,
                cleanBackupReviewer,
                dateStr,
                scheduledTime,
                leavesPool
            );
            if (!backupReviewerLeave.onLeave) {
                effectiveReviewer = cleanBackupReviewer;
                reviewerStatus = 'backup';
                reviewerDelegatedFrom = cleanPrimaryReviewer;
                reviewerVetFallback = false;
            } else {
                effectiveReviewer = cleanVetEmail;
                reviewerStatus = 'vet_fallback';
                reviewerDelegatedFrom = cleanPrimaryReviewer;
                reviewerVetFallback = true;
            }
        } else {
            effectiveReviewer = cleanVetEmail;
            reviewerStatus = 'vet_fallback';
            reviewerDelegatedFrom = cleanPrimaryReviewer;
            reviewerVetFallback = true;
        }
    }

    // 3. Guard against self-review (if backup caused effectiveReviewer === effectiveAssignee and not Vet)
    if (effectiveReviewer === effectiveAssignee && effectiveReviewer !== cleanVetEmail) {
        if (
            cleanBackupReviewer &&
            cleanBackupReviewer !== effectiveAssignee
        ) {
            const backupRevLeave = await isUserOnLeave(
                client,
                cleanBackupReviewer,
                dateStr,
                scheduledTime,
                leavesPool
            );
            if (!backupRevLeave.onLeave) {
                effectiveReviewer = cleanBackupReviewer;
                reviewerStatus = 'backup';
                reviewerDelegatedFrom = cleanPrimaryReviewer;
                reviewerVetFallback = false;
            } else {
                effectiveReviewer = cleanVetEmail;
                reviewerStatus = 'vet_fallback';
                reviewerDelegatedFrom = cleanPrimaryReviewer;
                reviewerVetFallback = true;
            }
        } else {
            effectiveReviewer = cleanVetEmail;
            reviewerStatus = 'vet_fallback';
            reviewerDelegatedFrom = cleanPrimaryReviewer;
            reviewerVetFallback = true;
        }
    }

    return {
        primaryAssignee: cleanPrimaryAssignee,
        backupAssignee: cleanBackupAssignee,
        effectiveAssignee,
        assignmentStatus,
        delegatedFrom,
        vetFallback,
        assigneeLeaveInfo,
        primaryReviewer: cleanPrimaryReviewer,
        backupReviewer: cleanBackupReviewer,
        effectiveReviewer,
        reviewerStatus,
        reviewerDelegatedFrom,
        reviewerVetFallback,
        reviewerLeaveInfo
    };
}
