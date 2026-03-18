import { requireAuth } from '../plugins/auth.js';
export async function gamesRoutes(app) {
    app.get('/games', { preHandler: requireAuth }, async (request, reply) => {
        const user = request.user;
        const supabase = request.supabase;
        const { data: rawGames } = await supabase
            .from('games')
            .select('*, odds(*)')
            .in('status', ['scheduled', 'live'])
            .order('start_time', { ascending: true })
            .limit(50);
        const games = (rawGames ?? []).map((g) => ({
            ...g,
            odds: Array.isArray(g.odds) ? (g.odds[0] ?? null) : g.odds,
        }));
        const { data: existingBets } = await supabase
            .from('bets')
            .select('game_id, market')
            .eq('user_id', user.id)
            .is('result', null);
        const bettedKeys = (existingBets ?? []).map((b) => `${b.game_id}:${b.market}`);
        return reply.send({ games, bettedKeys });
    });
}
