import { createClient } from '@supabase/supabase-js';
export function createServiceClient() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
export function createAnonClient() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}
/**
 * Create a Supabase client authenticated with the user's JWT.
 * The JWT comes from the sb-access-token cookie or Authorization header.
 */
export function createUserClient(accessToken) {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: {
            headers: { Authorization: `Bearer ${accessToken}` },
        },
    });
}
