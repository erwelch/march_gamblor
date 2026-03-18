import { createUserClient } from '../lib/supabase.js';
/**
 * Extract the Supabase access token from cookies or Authorization header.
 * Supabase JS client stores tokens in cookies named like sb-<ref>-auth-token.
 */
function extractAccessToken(request) {
    // Check Authorization header first
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    // Check cookies for Supabase auth token
    const cookies = request.cookies;
    for (const [name, value] of Object.entries(cookies)) {
        if (name.startsWith('sb-') && name.endsWith('-auth-token') && value) {
            // The cookie value might be a JSON-encoded array [access_token, refresh_token]
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed))
                    return parsed[0];
                return value;
            }
            catch {
                return value;
            }
        }
    }
    return null;
}
export async function requireAuth(request, reply) {
    const token = extractAccessToken(request);
    if (!token) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
    const supabase = createUserClient(token);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
    // Attach to request for downstream use
    ;
    request.user = user;
    request.supabase = supabase;
}
