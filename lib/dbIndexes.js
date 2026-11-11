/**
 * MongoDB Index Definitions and Helper for Pulsus collections.
 *
 * DB-01: Ensures essential compound and unique indexes exist across collections
 * to prevent full collection scans (COLLSCAN) and memory limit errors under load.
 */

export const INDEX_DEFINITIONS = [
    {
        collection: 'ritus_runs',
        indexes: [
            { key: { weekStart: 1, scheduledDate: 1, scheduledTime: 1 } },
            { key: { templateId: 1, scheduledDate: 1 }, options: { unique: true, sparse: true } },
            { key: { effectiveAssignee: 1, status: 1 } },
            { key: { effectiveReviewer: 1 } }
        ]
    },
    {
        collection: 'sequa_tasks',
        indexes: [
            { key: { status: 1, priority: 1 } },
            { key: { assignedTo: 1, status: 1 } },
            { key: { taskType: 1 } },
            { key: { createdAt: -1 } },
            { key: { status: 1, createdAt: -1 } },
            { key: { assignedTo: 1, createdAt: -1 } },
            { key: { taskType: 1, createdAt: -1 } },
            { key: { sourceRitusRunId: 1 } }
        ]
    },
    {
        collection: 'members',
        indexes: [
            { key: { email: 1 }, options: { unique: true } },
            { key: { pulsusRole: 1 } }
        ]
    },
    {
        collection: 'ritus_templates',
        indexes: [
            { key: { isActive: 1, daysOfWeek: 1 } }
        ]
    }
];

const ensuredDatabases = new Map();

/**
 * Ensures required indexes exist across Pulsus collections.
 * Wrapped in safe try/catch blocks so errors never block app startup or execution.
 *
 * @param {import('mongodb').Db} db - The MongoDB database instance
 * @param {object} [options]
 * @param {boolean} [options.force=false] - Force recreation/verification even if previously run
 * @returns {Promise<Array<{ collection: string, key: object, name?: string, success: boolean, error?: string }>>}
 */
export async function ensureIndexes(db, { force = false } = {}) {
    if (!db) {
        console.warn('[dbIndexes] No db instance provided to ensureIndexes');
        return [];
    }

    const dbName = db.databaseName || 'unknown_db';
    if (!force && ensuredDatabases.has(dbName)) {
        return ensuredDatabases.get(dbName);
    }

    const indexPromise = (async () => {
        const results = [];
        for (const def of INDEX_DEFINITIONS) {
            try {
                const col = db.collection(def.collection);
                for (const idx of def.indexes) {
                    try {
                        const name = await col.createIndex(idx.key, idx.options || {});
                        results.push({
                            collection: def.collection,
                            key: idx.key,
                            name,
                            options: idx.options || {},
                            success: true
                        });
                    } catch (idxErr) {
                        // If index exists with different options (e.g. adding unique/sparse), drop and recreate
                        if (
                            idxErr.code === 85 ||
                            idxErr.codeName === 'IndexOptionsConflict' ||
                            idxErr.codeName === 'IndexKeySpecsConflict' ||
                            (idxErr.message && idxErr.message.includes('different options'))
                        ) {
                            try {
                                const indexName =
                                    idx.options?.name ||
                                    Object.keys(idx.key)
                                        .map((k) => `${k}_${idx.key[k]}`)
                                        .join('_');
                                await col.dropIndex(indexName);
                                const name = await col.createIndex(idx.key, idx.options || {});
                                results.push({
                                    collection: def.collection,
                                    key: idx.key,
                                    name,
                                    options: idx.options || {},
                                    success: true
                                });
                                continue;
                            } catch (dropErr) {
                                console.warn(`[dbIndexes] Auto-migration of index failed on ${def.collection}:`, dropErr.message);
                            }
                        }

                        console.error(
                            `[dbIndexes] Failed to create index on ${def.collection}:`,
                            idx.key,
                            idxErr.message
                        );
                        results.push({
                            collection: def.collection,
                            key: idx.key,
                            options: idx.options || {},
                            success: false,
                            error: idxErr.message
                        });
                    }
                }
            } catch (colErr) {
                console.error(
                    `[dbIndexes] Failed to access collection ${def.collection}:`,
                    colErr.message
                );
                results.push({
                    collection: def.collection,
                    success: false,
                    error: colErr.message
                });
            }
        }
        return results;
    })();

    ensuredDatabases.set(dbName, indexPromise);

    try {
        return await indexPromise;
    } catch (err) {
        // If whole operation failed unexpectedly, remove from cache so retry is possible
        ensuredDatabases.delete(dbName);
        console.error('[dbIndexes] Unexpected error during ensureIndexes:', err.message);
        return [];
    }
}
