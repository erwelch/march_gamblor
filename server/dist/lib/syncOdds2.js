import SportsGameOdds from 'sports-odds-api';
import { createServiceClient } from './supabase';
const BOOKMAKER = 'draftkings';
const ODD_IDS = [
    'points-home-game-ml-home',
    'points-away-game-ml-away',
    'points-home-game-sp-home',
    'points-away-game-sp-away',
    'points-all-game-ou-over',
    'points-all-game-ou-under',
].join(',');
function parseOddsValue(val) {
    if (val == null || val === '')
        return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}
function parseEventOdds2(eventOdds, bookmakerID) {
    const bk = (oddID) => eventOdds?.[oddID]?.byBookmaker?.[bookmakerID];
    const consensus = (oddID) => eventOdds?.[oddID];
    const homeML = bk('points-home-game-ml-home');
    const awayML = bk('points-away-game-ml-away');
    const homeSP = bk('points-home-game-sp-home');
    const awaySP = bk('points-away-game-sp-away');
    const over = bk('points-all-game-ou-over');
    const under = bk('points-all-game-ou-under');
    // Fall back to consensus bookOdds if bookmaker-specific entry is missing
    const homeMLOdds = parseOddsValue(homeML?.odds ?? consensus('points-home-game-ml-home')?.bookOdds);
    const awayMLOdds = parseOddsValue(awayML?.odds ?? consensus('points-away-game-ml-away')?.bookOdds);
    const homeSpread = parseOddsValue(homeSP?.spread ?? consensus('points-home-game-sp-home')?.bookSpread);
    const homeSpPrice = parseOddsValue(homeSP?.odds ?? consensus('points-home-game-sp-home')?.bookOdds);
    const awaySpPrice = parseOddsValue(awaySP?.odds ?? consensus('points-away-game-sp-away')?.bookOdds);
    const ouLine = parseOddsValue(over?.overUnder ?? consensus('points-all-game-ou-over')?.bookOverUnder);
    const overPrice = parseOddsValue(over?.odds ?? consensus('points-all-game-ou-over')?.bookOdds);
    const underPrice = parseOddsValue(under?.odds ?? consensus('points-all-game-ou-under')?.bookOdds);
    return {
        bookmaker: bookmakerID,
        home_ml: homeMLOdds,
        away_ml: awayMLOdds,
        home_spread: homeSpread,
        home_spread_price: homeSpPrice,
        away_spread_price: awaySpPrice,
        over_under: ouLine,
        over_price: overPrice,
        under_price: underPrice,
    };
}
export async function syncOdds2() {
    const client = new SportsGameOdds({
        apiKeyHeader: process.env.SPORTS_ODDS_API_KEY_HEADER,
    });
    const supabase = createServiceClient();
    let upserted = 0;
    let total = 0;
    try {
        const startsAfter = new Date('2026-03-16T00:00:00.000Z').toISOString();
        for await (const event of client.events.get({
            sportID: 'BASKETBALL',
            leagueID: 'NCAAB',
            type: 'tournament',
            ended: false,
            oddsAvailable: true,
            bookmakerID: BOOKMAKER,
            oddID: ODD_IDS,
            startsAfter,
            limit: 15,
        })) {
            total++;
            if (!event.eventID)
                continue;
            const homeTeam = event.teams?.home?.names?.long ?? event.teams?.home?.names?.medium ?? '';
            const awayTeam = event.teams?.away?.names?.long ?? event.teams?.away?.names?.medium ?? '';
            const startTime = event.status?.startsAt;
            if (!startTime) {
                console.warn(`[syncOdds2] Skipping event ${event.eventID}: no startsAt`);
                continue;
            }
            const { data: game, error: gameError } = await supabase
                .from('games')
                .upsert({
                ncaa_game_id: event.eventID,
                home_team: homeTeam,
                away_team: awayTeam,
                start_time: startTime,
                game_date: startTime.substring(0, 10),
            }, { onConflict: 'ncaa_game_id', ignoreDuplicates: false })
                .select('id')
                .single();
            if (gameError || !game) {
                console.warn(`[syncOdds2] Failed to upsert game ${event.eventID}:`, gameError?.message);
                continue;
            }
            const parsed = parseEventOdds2(event.odds ?? {}, BOOKMAKER);
            const { error: oddsError } = await supabase
                .from('odds')
                .upsert({ game_id: game.id, ...parsed }, { onConflict: 'game_id,bookmaker' });
            if (oddsError) {
                console.warn(`[syncOdds2] Failed to upsert odds for game ${event.eventID}:`, oddsError?.message);
                continue;
            }
            upserted++;
        }
    }
    catch (err) {
        return { upserted, total, error: `Failed to fetch events: ${err?.message ?? err}` };
    }
    return { upserted, total };
}
