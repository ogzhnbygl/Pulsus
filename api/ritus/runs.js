import { verifyUser, VET_EMAIL } from '../lib/auth.js';
import clientPromise, { getDbName } from '../../lib/mongodb.js';
import {
    getMondayOfDate,
    addDays,
    isFridayDistributionTimeReached,
    distributeWeekPackage,
    syncPendingRunsWithCircaLeaves
} from '../../lib/ritusEngine.js';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const postActionSchema = z.object({
    action: z.enum(['distribute', 'sync_leaves']).default('distribute'),
    scope: z.enum(['current_week', 'next_week', 'custom']).optional(),
    targetWeekMonday: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-MM-DD formatında olmalıdır.')
        .optional(),
    referenceTime: z.string().optional()
});

const patchRunSchema = z.object({
    id: z.string().min(1, 'Görev (Run) ID gereklidir.'),
    action: z.enum([
        'start',
        'toggle_checklist',
        'submit_for_review',
        'approve',
        'request_revision',
        'escalate_to_vet',
        'vet_reassign'
    ]),
    note: z.string().max(1000).optional().default(''),
    checklistItemId: z.number().int().min(0).optional(),
    checklist: z
        .array(
            z.object({
                id: z.number().int(),
                text: z.string(),
                done: z.boolean(),
                completedAt: z.union([z.string(), z.date()]).optional().nullable(),
                completedBy: z.string().optional().nullable()
            }).passthrough()
        )
        .optional(),
    spawnSequa: z.boolean().optional().default(false),
    sequaTitle: z.string().max(150).optional(),
    sequaPriority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('high'),
    newAssigneeEmail: z.string().email().optional(),
    newReviewerEmail: z.string().email().optional()
});

export { distributeWeekPackage, syncPendingRunsWithCircaLeaves };

export default async function handler(req, res) {
    let user;
    try {
        user = await verifyUser(req);
    } catch (error) {
        return res.status(error.status || 401).json({ error: error.message });
    }

    const client = await clientPromise;
    const db = client.db(getDbName('Pulsus_db'));
    const runsCol = db.collection('ritus_runs');

    if (req.method === 'GET') {
        try {
            const now = new Date();
            const currentWeekMonday = getMondayOfDate(now);
            const nextWeekMonday = addDays(currentWeekMonday, 7);
            const fridayReached = isFridayDistributionTimeReached(now);

            const requestedWeek =
                req.query?.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(req.query.weekStart)
                    ? getMondayOfDate(req.query.weekStart)
                    : req.query?.week === 'next'
                      ? nextWeekMonday
                      : currentWeekMonday;

            // Ensure current week has runs distributed
            const currentWeekCount = await runsCol.countDocuments({ weekStart: currentWeekMonday });
            if (currentWeekCount === 0) {
                await distributeWeekPackage(client, db, currentWeekMonday);
            }

            // Friday 16:30 automatic distribution for next week (W+1)
            let nextWeekAutoDistributed = false;
            if (fridayReached) {
                const nextWeekCount = await runsCol.countDocuments({ weekStart: nextWeekMonday });
                if (nextWeekCount === 0) {
                    await distributeWeekPackage(client, db, nextWeekMonday);
                    nextWeekAutoDistributed = true;
                }
            }

            // Re-sync unstarted ('todo') runs with latest Circa approved leaves
            await syncPendingRunsWithCircaLeaves(client, db, requestedWeek);

            const filter = { weekStart: requestedWeek };
            if (req.query?.assignee && typeof req.query.assignee === 'string') {
                filter.effectiveAssignee = req.query.assignee.trim().toLowerCase();
            }
            if (req.query?.reviewer && typeof req.query.reviewer === 'string') {
                filter.effectiveReviewer = req.query.reviewer.trim().toLowerCase();
            }
            if (req.query?.status && typeof req.query.status === 'string') {
                filter.status = req.query.status.trim();
            }
            if (req.query?.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
                filter.scheduledDate = req.query.date;
            }

            const runs = await runsCol
                .find(filter)
                .sort({ scheduledDate: 1, scheduledTime: 1, title: 1 })
                .toArray();

            return res.status(200).json({
                runs,
                weekStart: requestedWeek,
                currentWeekMonday,
                nextWeekMonday,
                currentWeekStart: currentWeekMonday,
                nextWeekStart: nextWeekMonday,
                fridayDistributionActive: fridayReached,
                nextWeekAutoDistributed
            });
        } catch (error) {
            console.error('GET /api/ritus/runs error:', error);
            return res.status(500).json({ error: 'Rutin görev listesi alınırken hata oluştu.' });
        }
    }

    if (req.method === 'POST') {
        const parsed = postActionSchema.safeParse(req.body || {});
        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.issues?.[0]?.message || 'Geçersiz dağıtım parametresi.'
            });
        }

        const { action, scope, targetWeekMonday, referenceTime } = parsed.data;

        try {
            const refDate = referenceTime ? new Date(referenceTime) : new Date();
            const baseMonday = getMondayOfDate(Number.isNaN(refDate.getTime()) ? new Date() : refDate);

            let resolvedWeekMonday = baseMonday;
            if (targetWeekMonday) {
                resolvedWeekMonday = getMondayOfDate(targetWeekMonday);
            } else if (scope === 'next_week') {
                resolvedWeekMonday = addDays(baseMonday, 7);
            } else if (scope === 'current_week') {
                resolvedWeekMonday = baseMonday;
            } else if (isFridayDistributionTimeReached(refDate)) {
                resolvedWeekMonday = addDays(baseMonday, 7);
            }

            if (action === 'sync_leaves') {
                const updatedCount = await syncPendingRunsWithCircaLeaves(
                    client,
                    db,
                    resolvedWeekMonday
                );
                const runs = await runsCol
                    .find({ weekStart: resolvedWeekMonday })
                    .sort({ scheduledDate: 1, scheduledTime: 1 })
                    .toArray();
                return res.status(200).json({
                    synced: true,
                    weekStart: resolvedWeekMonday,
                    updatedCount,
                    runs
                });
            }

            // Only Vet or Technician can manually trigger full package distribution
            if (user.pulsusRole === 'caretaker') {
                return res.status(403).json({
                    error: 'Haftalık iş paketi dağıtımını yalnızca Veteriner Hekim veya Tekniker tetikleyebilir.'
                });
            }

            const distResult = await distributeWeekPackage(client, db, resolvedWeekMonday);
            await syncPendingRunsWithCircaLeaves(client, db, resolvedWeekMonday);

            const runs = await runsCol
                .find({ weekStart: resolvedWeekMonday })
                .sort({ scheduledDate: 1, scheduledTime: 1 })
                .toArray();

            return res.status(200).json({
                distributed: true,
                weekStart: distResult.weekStart,
                createdCount: distResult.createdCount,
                existingCount: distResult.existingCount,
                runs
            });
        } catch (error) {
            console.error('POST /api/ritus/runs error:', error);
            return res.status(500).json({ error: 'Haftalık iş paketi dağıtılırken hata oluştu.' });
        }
    }

    if (req.method === 'PATCH') {
        const parsed = patchRunSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.issues?.[0]?.message || 'Geçersiz işlem verisi.'
            });
        }

        const data = parsed.data;
        if (!ObjectId.isValid(data.id)) {
            return res.status(400).json({ error: 'Geçersiz görev ID formatı.' });
        }

        try {
            const runObjectId = new ObjectId(data.id);
            const run = await runsCol.findOne({ _id: runObjectId });
            if (!run) {
                return res.status(404).json({ error: 'Rutin görev kaydı bulunamadı.' });
            }

            const userEmail = user.email.toLowerCase();
            const isVet = user.pulsusRole === 'vet';
            const isTech = user.pulsusRole === 'technician';
            const isEffectiveAssignee = run.effectiveAssignee?.toLowerCase() === userEmail;
            const isEffectiveReviewer = run.effectiveReviewer?.toLowerCase() === userEmail;
            const now = new Date();

            // 1. START
            if (data.action === 'start') {
                if (!isEffectiveAssignee && !isVet && !isTech) {
                    return res.status(403).json({
                        error: 'Bu görevi yalnızca atanmış sorumlu personel başlatabilir.'
                    });
                }
                if (run.status === 'done') {
                    return res.status(400).json({ error: 'Tamamlanmış bir görev tekrar başlatılamaz.' });
                }
                if (!['todo', 'needs_revision'].includes(run.status)) {
                    return res.status(400).json({
                        error: `'${run.status}' durumundaki bir görev başlatılamaz.`
                    });
                }
                const historyItem = {
                    action: 'start',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note: data.note || 'Görev başlatıldı.'
                };
                await runsCol.updateOne(
                    { _id: runObjectId },
                    {
                        $set: { status: 'in_progress', startedAt: run.startedAt || now, updatedAt: now },
                        $push: { reviewHistory: historyItem }
                    }
                );
                const updated = await runsCol.findOne({ _id: runObjectId });
                return res.status(200).json({ run: updated });
            }

            // 2. TOGGLE_CHECKLIST
            if (data.action === 'toggle_checklist') {
                if (!isEffectiveAssignee && !isEffectiveReviewer && !isVet) {
                    return res.status(403).json({
                        error: 'Kontrol listesini yalnızca görev sorumlusu veya denetçisi güncelleyebilir.'
                    });
                }
                if (run.status === 'done') {
                    return res.status(400).json({
                        error: 'Tamamlanmış ve onaylanmış görevlerin kontrol listesi değiştirilemez.'
                    });
                }

                if (typeof data.checklistItemId === 'number') {
                    const currentItem = Array.isArray(run.checklist)
                        ? run.checklist.find(item => item.id === data.checklistItemId)
                        : null;
                    const nextDone = currentItem ? !currentItem.done : true;

                    await runsCol.updateOne(
                        { _id: runObjectId },
                        {
                            $set: {
                                'checklist.$[elem].done': nextDone,
                                'checklist.$[elem].completedAt': nextDone ? now : null,
                                'checklist.$[elem].completedBy': nextDone ? userEmail : null,
                                updatedAt: now
                            }
                        },
                        {
                            arrayFilters: [{ 'elem.id': data.checklistItemId }]
                        }
                    );
                } else if (Array.isArray(data.checklist)) {
                    await runsCol.updateOne(
                        { _id: runObjectId },
                        { $set: { checklist: data.checklist, updatedAt: now } }
                    );
                }

                const updated = await runsCol.findOne({ _id: runObjectId });
                return res.status(200).json({ run: updated });
            }

            // 3. SUBMIT_FOR_REVIEW
            if (data.action === 'submit_for_review') {
                if (!isEffectiveAssignee && !isVet) {
                    return res.status(403).json({
                        error: 'Görevi denetime yalnızca atanmış sorumlu personel gönderebilir.'
                    });
                }
                if (run.status === 'todo') {
                    return res.status(400).json({
                        error: 'Görev başlatılmadan denetime gönderilemez.'
                    });
                }
                if (!['in_progress', 'needs_revision'].includes(run.status)) {
                    return res.status(400).json({
                        error: `'${run.status}' durumundaki bir görev denetime gönderilemez.`
                    });
                }
                if (Array.isArray(run.checklist) && run.checklist.some(item => !item.done)) {
                    return res.status(400).json({
                        error: 'Tüm kontrol listesi maddeleri tamamlanmadan denetime sunulamaz.'
                    });
                }

                // Mark all checklist items done if not already or keep current state
                const historyItem = {
                    action: 'submit_for_review',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note: data.note || 'Görev tamamlandı ve denetim onayına sunuldu.'
                };

                await runsCol.updateOne(
                    { _id: runObjectId },
                    {
                        $set: {
                            status: 'pending_review',
                            submittedAt: now,
                            submittedBy: userEmail,
                            updatedAt: now
                        },
                        $push: { reviewHistory: historyItem }
                    }
                );
                const updated = await runsCol.findOne({ _id: runObjectId });
                return res.status(200).json({ run: updated });
            }

            // 4. APPROVE
            if (data.action === 'approve') {
                if (user.pulsusRole === 'caretaker') {
                    return res.status(403).json({
                        error: 'Bakıcı/Temizlik personeli görev onaylayamaz.'
                    });
                }
                if (!isEffectiveReviewer && !isVet) {
                    return res.status(403).json({
                        error: 'Bu görevi yalnızca atanmış Denetçi veya Sorumlu Veteriner Hekim onaylayabilir.'
                    });
                }
                if (!['pending_review', 'escalated'].includes(run.status)) {
                    return res.status(400).json({
                        error: `'${run.status}' durumundaki görev denetimden geçmeden onaylanamaz.`
                    });
                }

                const historyItem = {
                    action: 'approve',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note: data.note || 'Denetim onayı verildi.'
                };

                await runsCol.updateOne(
                    { _id: runObjectId },
                    {
                        $set: {
                            status: 'done',
                            completedAt: now,
                            approvedBy: userEmail,
                            updatedAt: now
                        },
                        $push: { reviewHistory: historyItem }
                    }
                );
                const updated = await runsCol.findOne({ _id: runObjectId });
                return res.status(200).json({ run: updated });
            }

            // 5. REQUEST_REVISION (Repeat task)
            if (data.action === 'request_revision') {
                if (user.pulsusRole === 'caretaker') {
                    return res.status(403).json({
                        error: 'Bakıcı/Temizlik personeli revizyon/tekrar talep edemez.'
                    });
                }
                if (!isEffectiveReviewer && !isVet) {
                    return res.status(403).json({
                        error: 'Bu göreve yalnızca atanmış Denetçi veya Sorumlu Veteriner Hekim tekrar (revizyon) isteyebilir.'
                    });
                }
                if (run.status !== 'pending_review') {
                    return res.status(400).json({
                        error: 'Yalnızca denetim bekleyen (pending_review) görevler için revizyon talep edilebilir.'
                    });
                }
                if (!data.note || data.note.trim().length < 2) {
                    return res.status(400).json({
                        error: 'Görevin neden tekrarlanması gerektiğini belirten bir denetim notu zorunludur.'
                    });
                }

                const historyItem = {
                    action: 'request_revision',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note: data.note.trim()
                };

                await runsCol.updateOne(
                    { _id: runObjectId },
                    {
                        $set: {
                            status: 'needs_revision',
                            lastRevisionNote: data.note.trim(),
                            lastRevisionBy: userEmail,
                            updatedAt: now
                        },
                        $inc: { revisionCount: 1 },
                        $push: { reviewHistory: historyItem }
                    }
                );
                const updated = await runsCol.findOne({ _id: runObjectId });
                return res.status(200).json({ run: updated });
            }

            // 6. ESCALATE_TO_VET
            if (data.action === 'escalate_to_vet') {
                if (!isTech && !isEffectiveReviewer && !isVet) {
                    return res.status(403).json({
                        error: 'Veteriner Hekime eskalasyon yalnızca Tekniker veya Denetçi tarafından yapılabilir.'
                    });
                }
                if (!data.note || data.note.trim().length < 2) {
                    return res.status(400).json({
                        error: 'Veteriner Hekime sevk (eskalasyon) gerekçesi belirtilmelidir.'
                    });
                }

                const historyItem = {
                    action: 'escalate_to_vet',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note: data.note.trim()
                };

                let spawnedSequaTask = null;
                const spawnedIds = Array.isArray(run.spawnedSequaIds) ? [...run.spawnedSequaIds] : [];

                if (data.spawnSequa) {
                    const sequaCol = db.collection('sequa_tasks');
                    const sequaId = new ObjectId();
                    const sequaDoc = {
                        _id: sequaId,
                        title: data.sequaTitle?.trim() || `[Ritus Eskalasyon] ${run.title}`,
                        description: data.note.trim(),
                        taskType: 'vet_request',
                        priority: data.sequaPriority || 'high',
                        status: 'todo',
                        createdBy: userEmail,
                        createdByName: user.name,
                        createdByRole: user.pulsusRole,
                        assignedTo: VET_EMAIL,
                        assignedToRole: 'vet',
                        reviewerEmail: VET_EMAIL,
                        externalUnit: null,
                        sourceRitusRunId: run._id.toString(),
                        sourceRitusTitle: run.title,
                        contextRef: run.contextRef || null,
                        activityLog: [
                            {
                                action: 'created_from_ritus_escalation',
                                by: userEmail,
                                byName: user.name,
                                at: now,
                                note: data.note.trim()
                            }
                        ],
                        createdAt: now,
                        updatedAt: now
                    };
                    const updatedSpawnedIds = [...spawnedIds, sequaId.toString()];

                    const updateRunPayload = {
                        $set: {
                            status: 'escalated',
                            escalatedTo: VET_EMAIL,
                            escalationNote: data.note.trim(),
                            escalatedBy: userEmail,
                            escalatedAt: now,
                            effectiveReviewer: VET_EMAIL,
                            spawnedSequaIds: updatedSpawnedIds,
                            updatedAt: now
                        },
                        $push: { reviewHistory: historyItem }
                    };

                    let committed = false;
                    let session = null;
                    try {
                        if (typeof client.startSession === 'function') {
                            session = client.startSession();
                            await session.withTransaction(async () => {
                                await sequaCol.insertOne(sequaDoc, { session });
                                const updateRes = await runsCol.updateOne(
                                    { _id: runObjectId },
                                    updateRunPayload,
                                    { session }
                                );
                                if (updateRes.matchedCount === 0) {
                                    throw new Error('Rutin görev kaydı bulunamadı.');
                                }
                            });
                            committed = true;
                            spawnedSequaTask = sequaDoc;
                        }
                    } catch (txErr) {
                        const isUnsupported =
                            txErr?.code === 20 ||
                            txErr?.codeName === 'IllegalOperation' ||
                            /transaction numbers are only allowed on a replica set member/i.test(txErr?.message || '') ||
                            /transactions are not supported/i.test(txErr?.message || '');

                        if (!isUnsupported) {
                            throw txErr;
                        }
                    } finally {
                        if (session) {
                            try {
                                await session.endSession();
                            } catch (_) {}
                        }
                    }

                    // Fallback with compensating rollback if transactions are not supported on deployment
                    if (!committed) {
                        let insertedSequaId = null;
                        try {
                            const seqRes = await sequaCol.insertOne(sequaDoc);
                            insertedSequaId = seqRes.insertedId || sequaId;
                            const updateRes = await runsCol.updateOne({ _id: runObjectId }, updateRunPayload);
                            if (updateRes.matchedCount === 0) {
                                throw new Error('Rutin görev kaydı bulunamadı.');
                            }
                            spawnedSequaTask = sequaDoc;
                        } catch (fallbackErr) {
                            if (insertedSequaId) {
                                try {
                                    await sequaCol.deleteOne({ _id: insertedSequaId });
                                } catch (cleanupErr) {
                                    console.error('Failed to compensate/cleanup Sequa ticket:', cleanupErr);
                                }
                            }
                            throw fallbackErr;
                        }
                    }
                } else {
                    await runsCol.updateOne(
                        { _id: runObjectId },
                        {
                            $set: {
                                status: 'escalated',
                                escalatedTo: VET_EMAIL,
                                escalationNote: data.note.trim(),
                                escalatedBy: userEmail,
                                escalatedAt: now,
                                effectiveReviewer: VET_EMAIL,
                                spawnedSequaIds: spawnedIds,
                                updatedAt: now
                            },
                            $push: { reviewHistory: historyItem }
                        }
                    );
                }

                const updated = await runsCol.findOne({ _id: runObjectId });
                return res.status(200).json({ run: updated, spawnedSequaTask });
            }

            // 7. VET_REASSIGN
            if (data.action === 'vet_reassign') {
                if (!isVet) {
                    return res.status(403).json({
                        error: 'Görev yeniden atama yetkisi yalnızca Sorumlu Veteriner Hekime aittir.'
                    });
                }
                if (!data.newAssigneeEmail && !data.newReviewerEmail) {
                    return res.status(400).json({
                        error: 'Yeni sorumlu veya yeni denetçi e-posta adresi belirtilmelidir.'
                    });
                }

                const setPayload = {
                    reassignedByVet: true,
                    updatedAt: now
                };

                if (data.newAssigneeEmail) {
                    const cleanAssignee = data.newAssigneeEmail.trim().toLowerCase();
                    setPayload.effectiveAssignee = cleanAssignee;
                    setPayload.assignmentStatus = 'reassigned_by_vet';
                    setPayload.vetFallback = cleanAssignee === VET_EMAIL;
                }

                if (data.newReviewerEmail) {
                    const cleanReviewer = data.newReviewerEmail.trim().toLowerCase();
                    setPayload.effectiveReviewer = cleanReviewer;
                    setPayload.reviewerStatus = 'reassigned_by_vet';
                    setPayload.reviewerVetFallback = cleanReviewer === VET_EMAIL;
                }

                const historyItem = {
                    action: 'vet_reassign',
                    by: userEmail,
                    byName: user.name,
                    at: now,
                    note:
                        data.note ||
                        `Veteriner Hekim tarafından yeniden atandı (${data.newAssigneeEmail || run.effectiveAssignee}).`
                };

                await runsCol.updateOne(
                    { _id: runObjectId },
                    {
                        $set: setPayload,
                        $push: { reviewHistory: historyItem }
                    }
                );

                const updated = await runsCol.findOne({ _id: runObjectId });
                return res.status(200).json({ run: updated });
            }

            return res.status(400).json({ error: 'Desteklenmeyen işlem.' });
        } catch (error) {
            console.error('PATCH /api/ritus/runs error:', error);
            return res.status(500).json({ error: 'Görev durumu güncellenirken hata oluştu.' });
        }
    }

    if (req.method === 'DELETE') {
        if (user.pulsusRole !== 'vet') {
            return res.status(403).json({
                error: 'Rutin görev kartlarını silme yetkisi yalnızca Sorumlu Veteriner Hekime aittir.'
            });
        }

        const targetId = req.body?.id || req.body?._id || req.query?.id;
        if (!targetId || !ObjectId.isValid(targetId)) {
            return res.status(400).json({ error: 'Geçerli bir görev ID gereklidir.' });
        }

        try {
            const runObjectId = new ObjectId(targetId);
            const delRes = await runsCol.deleteOne({ _id: runObjectId });
            if (!delRes.deletedCount) {
                return res.status(404).json({ error: 'Silinecek görev kartı bulunamadı.' });
            }
            return res.status(200).json({ success: true, deletedId: targetId });
        } catch (error) {
            console.error('DELETE /api/ritus/runs error:', error);
            return res.status(500).json({ error: 'Görev kartı silinirken hata oluştu.' });
        }
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
}
