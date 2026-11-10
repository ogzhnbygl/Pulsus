import { MongoClient } from 'mongodb';
import { ensureIndexes } from './dbIndexes.js';

if (!process.env.MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options = {
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 15000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000
};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    // In serverless production/preview environments (e.g. Vercel lambdas), reuse connection
    // across warm invocations via global variable to prevent Atlas connection exhaustion.
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
}

// Safely ensure indexes in background when client connects
clientPromise
    .then(async (c) => {
        try {
            const dbName = getDbName('Pulsus_db');
            const db = c.db(dbName);
            await ensureIndexes(db);
        } catch (err) {
            console.error('[mongodb] Background index initialization error:', err);
        }
    })
    .catch((_err) => {
        // Connection errors will be handled when clientPromise is awaited in callers
    });

export function isProdEnv() {
    return process.env.VERCEL_ENV === 'production' || process.env.FORCE_PROD_DB === 'true';
}

export function getDbName(baseName) {
    if (isProdEnv()) return baseName;
    return baseName.endsWith('_db')
        ? baseName.replace(/_db$/, '_test_db')
        : `${baseName}_test`;
}

export function getSessionCookieName() {
    return isProdEnv() ? 'interapp_session' : 'interapp_session_test';
}

export { ensureIndexes };
export default clientPromise;
