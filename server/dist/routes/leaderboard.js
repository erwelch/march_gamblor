import { requireAuth } from '../plugins/auth.js';
export async function leaderboardRoutes(app) {
    app.get('/leaderboard', { preHandler: requireAuth }, async (request, reply) => {
        const user = request.user;
        const supabase = request.supabase;
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, balance')
            .order('balance', { ascending: false });
        return reply.send({ profiles: profiles ?? [], userId: user.id });
    });
}
