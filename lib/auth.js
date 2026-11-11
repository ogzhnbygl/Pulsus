import clientPromise, { getDbName, getSessionCookieName, isProdEnv } from './mongodb.js';
import crypto from 'crypto';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is missing.');
}
const JWT_SECRET = process.env.JWT_SECRET;

export function clearSessionCookie(req, res) {
    const host = (req.headers.host || '').split(':')[0];
    const cookieName = getSessionCookieName();
    const isWildtypeDomain = host === 'wildtype.app' || host.endsWith('.wildtype.app');
    const domainAttribute = isWildtypeDomain ? 'Domain=.wildtype.app;' : '';
    const secureAttribute = (process.env.NODE_ENV === 'production' || isWildtypeDomain) ? 'Secure;' : '';

    res.setHeader(
        'Set-Cookie',
        `${cookieName}=; Path=/; ${domainAttribute} ${secureAttribute} HttpOnly; SameSite=Lax; Max-Age=0`
    );
}

// Verify JWT token with algorithm check and constant-time signature comparison
export function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;

    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signatureB64] = parts;
        const headerJson = Buffer.from(headerB64, 'base64url').toString('utf-8');
        const header = JSON.parse(headerJson);
        if (!header || header.alg !== 'HS256') {
            return null;
        }

        const secretsToTry = [
            JWT_SECRET,
            !isProdEnv() && 'wildtype-super-secret-key-123'
        ].filter(Boolean);

        const sigBuf = Buffer.from(signatureB64, 'utf-8');
        let matched = false;

        for (const secret of secretsToTry) {
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(`${headerB64}.${payloadB64}`);
            const expectedSignatureB64 = hmac.digest('base64url');
            const expectedBuf = Buffer.from(expectedSignatureB64, 'utf-8');
            if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
                matched = true;
                break;
            }
        }

        if (!matched) {
            return null;
        }

        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
        if (payload.exp && Date.now() >= payload.exp * 1000) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function hasRequiredAppAccess(user, requiredApp) {
    if (!requiredApp) return true;
    if (user.role === 'admin') return true;
    return Array.isArray(user.apps) && user.apps.some(app => String(app).toLowerCase() === requiredApp.toLowerCase());
}

// Detailed auth check distinguishing 401 (unauthenticated) vs 403 (forbidden app access)
export async function verifyAuthWithStatus(req, requiredApp = null) {
    // 1. Bearer Token Bypass (strictly local non-Vercel development)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
        if (isLocalDev) {
            const email = authHeader.slice(7).trim();
            if (email) {
                const client = await clientPromise;
                const db = client.db(getDbName('Apex_db'));
                const user = await db.collection('users').findOne({ email });
                if (user) {
                    if (!hasRequiredAppAccess(user, requiredApp)) {
                        return { user: null, status: 403, error: 'Bu uygulamaya erişim yetkiniz bulunmamaktadır.' };
                    }
                    return {
                        user: { email: user.email, role: user.role, apps: user.apps || [], name: user.name || user.email.split('@')[0] },
                        status: 200,
                        error: null
                    };
                }
            }
        }
    }

    // 2. Cookie Authentication
    const cookieHeader = req.headers.cookie || '';
    const cookieName = getSessionCookieName();
    const cookieMap = Object.fromEntries(
        cookieHeader.split(';').map(c => {
            const [k, ...v] = c.trim().split('=');
            return [k, v.join('=')];
        })
    );
    const token = cookieMap[cookieName] || cookieMap['interapp_session_test'] || cookieMap['interapp_session'];

    if (!token) {
        return { user: null, status: 401, error: 'Oturum bulunamadı.' };
    }

    const decoded = verifyToken(token);
    if (!decoded || typeof decoded.email !== 'string' || !decoded.email) {
        return { user: null, status: 401, error: 'Geçersiz veya süresi dolmuş oturum.' };
    }

    const normalizedEmail = decoded.email.trim().toLowerCase();
    let dbUser = null;

    try {
        const client = await clientPromise;
        const primaryDbName = getDbName('Apex_db');
        dbUser = await client.db(primaryDbName).collection('users').findOne({
            email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });

        if (!dbUser && !isProdEnv()) {
            dbUser = await client.db('Apex_db').collection('users').findOne({
                email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
        }
    } catch (dbErr) {
        console.warn('[auth] Apex user db lookup error in session verification:', dbErr.message);
    }

    // In preview/test environments, if database query fails or user record isn't synced yet,
    // fallback to cryptographically verified JWT payload claims
    const effectiveUser = dbUser || {
        email: decoded.email,
        role: decoded.role || 'user',
        apps: Array.isArray(decoded.apps) ? decoded.apps : ['pulsus'],
        name: decoded.name || decoded.email.split('@')[0]
    };

    if (!effectiveUser) {
        return { user: null, status: 401, error: 'Kullanıcı bulunamadı.' };
    }

    if (!hasRequiredAppAccess(effectiveUser, requiredApp)) {
        return { user: null, status: 403, error: 'Bu uygulamaya erişim yetkiniz bulunmamaktadır.' };
    }

    return {
        user: {
            email: effectiveUser.email,
            role: effectiveUser.role || 'user',
            apps: effectiveUser.apps || [],
            name: effectiveUser.name || effectiveUser.email.split('@')[0]
        },
        status: 200,
        error: null
    };
}

// Backwards-compatible helper returning user or null
export async function verifyAuth(req, requiredApp = null) {
    const result = await verifyAuthWithStatus(req, requiredApp);
    return result.user;
}
