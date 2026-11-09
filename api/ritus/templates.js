import { verifyUser } from '../lib/auth.js';
import clientPromise, { getDbName } from '../../lib/mongodb.js';
import {
    ensureDefaultRitusTemplates,
    getMondayOfDate,
    syncTemplateToCurrentWeekRuns
} from '../../lib/ritusEngine.js';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const contextRefSchema = z
    .object({
        module: z.string().max(60).nullable().optional(),
        entityType: z.string().max(60).nullable().optional(),
        entityId: z.string().max(120).nullable().optional(),
        label: z.string().max(150).nullable().optional()
    })
    .nullable()
    .optional();

const templatePayloadSchema = z.object({
    id: z.string().optional(),
    _id: z.string().optional(),
    title: z.string().min(2, 'Görev başlığı en az 2 karakter olmalıdır.').max(150),
    description: z.string().max(1000).optional().default(''),
    category: z
        .enum(['cleaning', 'feeding', 'health', 'calibration', 'biosecurity', 'admin', 'other'])
        .default('other'),
    frequency: z.enum(['weekly', 'monthly', 'quarterly']).default('weekly'),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).optional().default([]),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    monthsOfQuarter: z.array(z.number().int().min(1).max(12)).optional().default([1, 4, 7, 10]),
    scheduledTime: z
        .string()
        .regex(timeRegex, 'Planlanan saat HH:MM formatında olmalıdır.')
        .default('09:00'),
    primaryAssignee: z.string().email('Asil sorumlu e-posta adresi geçersiz.'),
    backupAssignee: z.string().email().nullable().optional().or(z.literal('')),
    primaryReviewer: z.string().email('Asil denetçi e-posta adresi geçersiz.'),
    backupReviewer: z.string().email().nullable().optional().or(z.literal('')),
    checklist: z.array(z.string().min(1).max(300)).optional().default([]),
    contextRef: contextRefSchema,
    isActive: z.boolean().optional().default(true),
    updateScope: z.enum(['current_week', 'next_week']).optional().default('next_week'),
    targetWeekStart: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
});

export default async function handler(req, res) {
    let user;
    try {
        user = await verifyUser(req);
    } catch (error) {
        return res.status(error.status || 401).json({ error: error.message });
    }

    const client = await clientPromise;
    const db = client.db(getDbName('Pulsus_db'));
    await ensureDefaultRitusTemplates(db);
    const templatesCol = db.collection('ritus_templates');

    if (req.method === 'GET') {
        try {
            const templates = await templatesCol
                .find({})
                .sort({ isActive: -1, frequency: 1, scheduledTime: 1, title: 1 })
                .toArray();
            return res.status(200).json({ templates });
        } catch (error) {
            console.error('GET /api/ritus/templates error:', error);
            return res.status(500).json({ error: 'Rutin görev şablonları alınırken hata oluştu.' });
        }
    }

    // Strict Vet-only access control for POST, PUT, DELETE
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        if (user.pulsusRole !== 'vet') {
            return res.status(403).json({
                error: 'Rutin görev şablonlarını yalnızca Sorumlu Veteriner Hekim oluşturabilir ve değiştirebilir.'
            });
        }
    }

    if (req.method === 'POST') {
        const parsed = templatePayloadSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.issues?.[0]?.message || 'Geçersiz şablon verisi.'
            });
        }

        try {
            const data = parsed.data;
            const now = new Date();

            if (data.frequency === 'weekly' && (!data.daysOfWeek || data.daysOfWeek.length === 0)) {
                return res.status(400).json({
                    error: 'Haftalık rutin görevler için en az bir gün (Pazartesi-Pazar) seçilmelidir.'
                });
            }

            const newDoc = {
                title: data.title.trim(),
                description: (data.description || '').trim(),
                category: data.category,
                frequency: data.frequency,
                daysOfWeek: [...new Set(data.daysOfWeek)].sort((a, b) => a - b),
                dayOfMonth: data.dayOfMonth ?? (data.frequency !== 'weekly' ? 1 : null),
                monthsOfQuarter:
                    data.frequency === 'quarterly'
                        ? data.monthsOfQuarter?.length > 0
                            ? [...new Set(data.monthsOfQuarter)].sort((a, b) => a - b)
                            : [1, 4, 7, 10]
                        : [],
                scheduledTime: data.scheduledTime,
                primaryAssignee: data.primaryAssignee.trim().toLowerCase(),
                backupAssignee: data.backupAssignee ? data.backupAssignee.trim().toLowerCase() : null,
                primaryReviewer: data.primaryReviewer.trim().toLowerCase(),
                backupReviewer: data.backupReviewer ? data.backupReviewer.trim().toLowerCase() : null,
                checklist: (data.checklist || []).map(c => c.trim()).filter(Boolean),
                contextRef: data.contextRef || null,
                isActive: data.isActive ?? true,
                createdBy: user.email,
                createdAt: now,
                updatedAt: now
            };

            const insertRes = await templatesCol.insertOne(newDoc);
            const savedTemplate = { ...newDoc, _id: insertRes.insertedId };

            let affectedCurrentWeekRuns = 0;
            if (data.updateScope === 'current_week') {
                const currentWeekStart = getMondayOfDate(data.targetWeekStart || new Date());
                affectedCurrentWeekRuns = await syncTemplateToCurrentWeekRuns(
                    client,
                    db,
                    savedTemplate,
                    currentWeekStart
                );
            }

            return res.status(201).json({
                template: savedTemplate,
                updateScope: data.updateScope,
                affectedCurrentWeekRuns
            });
        } catch (error) {
            console.error('POST /api/ritus/templates error:', error);
            return res.status(500).json({ error: 'Rutin görev şablonu oluşturulurken hata oluştu.' });
        }
    }

    if (req.method === 'PUT') {
        const parsed = templatePayloadSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.issues?.[0]?.message || 'Geçersiz şablon güncelleme verisi.'
            });
        }

        const data = parsed.data;
        const targetId = data.id || data._id || req.query?.id;
        if (!targetId || !ObjectId.isValid(targetId)) {
            return res.status(400).json({ error: 'Geçerli bir şablon ID gereklidir.' });
        }

        try {
            const objectId = new ObjectId(targetId);
            const existing = await templatesCol.findOne({ _id: objectId });
            if (!existing) {
                return res.status(404).json({ error: 'Rutin görev şablonu bulunamadı.' });
            }

            if (data.frequency === 'weekly' && (!data.daysOfWeek || data.daysOfWeek.length === 0)) {
                return res.status(400).json({
                    error: 'Haftalık rutin görevler için en az bir gün seçilmelidir.'
                });
            }

            const now = new Date();
            const updateFields = {
                title: data.title.trim(),
                description: (data.description || '').trim(),
                category: data.category,
                frequency: data.frequency,
                daysOfWeek: [...new Set(data.daysOfWeek)].sort((a, b) => a - b),
                dayOfMonth: data.dayOfMonth ?? (data.frequency !== 'weekly' ? 1 : null),
                monthsOfQuarter:
                    data.frequency === 'quarterly'
                        ? data.monthsOfQuarter?.length > 0
                            ? [...new Set(data.monthsOfQuarter)].sort((a, b) => a - b)
                            : [1, 4, 7, 10]
                        : [],
                scheduledTime: data.scheduledTime,
                primaryAssignee: data.primaryAssignee.trim().toLowerCase(),
                backupAssignee: data.backupAssignee ? data.backupAssignee.trim().toLowerCase() : null,
                primaryReviewer: data.primaryReviewer.trim().toLowerCase(),
                backupReviewer: data.backupReviewer ? data.backupReviewer.trim().toLowerCase() : null,
                checklist: (data.checklist || []).map(c => c.trim()).filter(Boolean),
                contextRef: data.contextRef !== undefined ? data.contextRef : existing.contextRef,
                isActive: data.isActive ?? existing.isActive,
                updatedBy: user.email,
                updatedAt: now
            };

            await templatesCol.updateOne({ _id: objectId }, { $set: updateFields });
            const updatedTemplate = await templatesCol.findOne({ _id: objectId });

            let affectedCurrentWeekRuns = 0;
            if (data.updateScope === 'current_week') {
                const currentWeekStart = getMondayOfDate(data.targetWeekStart || new Date());
                affectedCurrentWeekRuns = await syncTemplateToCurrentWeekRuns(
                    client,
                    db,
                    updatedTemplate,
                    currentWeekStart
                );
            }

            return res.status(200).json({
                template: updatedTemplate,
                updateScope: data.updateScope,
                affectedCurrentWeekRuns
            });
        } catch (error) {
            console.error('PUT /api/ritus/templates error:', error);
            return res.status(500).json({ error: 'Rutin görev şablonu güncellenirken hata oluştu.' });
        }
    }

    if (req.method === 'DELETE') {
        const targetId = req.body?.id || req.body?._id || req.query?.id;
        const updateScope = req.body?.updateScope || req.query?.updateScope || 'current_week';

        if (!targetId || !ObjectId.isValid(targetId)) {
            return res.status(400).json({ error: 'Geçerli bir şablon ID gereklidir.' });
        }

        try {
            const objectId = new ObjectId(targetId);
            const existing = await templatesCol.findOne({ _id: objectId });
            if (!existing) {
                return res.status(404).json({ error: 'Şablon bulunamadı.' });
            }

            await db.collection('system_meta').updateOne(
                { _id: 'ritus_templates_seeded' },
                { $set: { seeded: true, updatedAt: new Date() } },
                { upsert: true }
            );

            await templatesCol.deleteOne({ _id: objectId });

            let affectedCurrentWeekRuns = 0;
            if (updateScope === 'current_week') {
                const delRuns = await db.collection('ritus_runs').deleteMany({
                    templateId: objectId.toString(),
                    status: { $ne: 'done' }
                });
                affectedCurrentWeekRuns = delRuns.deletedCount || 0;
            }

            return res.status(200).json({
                success: true,
                deletedId: targetId,
                updateScope,
                affectedCurrentWeekRuns
            });
        } catch (error) {
            console.error('DELETE /api/ritus/templates error:', error);
            return res.status(500).json({ error: 'Şablon silinirken hata oluştu.' });
        }
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
}
