export function americanToDecimal(american) {
    if (american >= 0)
        return 1 + american / 100;
    return 1 + 100 / Math.abs(american);
}
export function calculatePayout(stake, americanOdds) {
    return Math.round(stake * americanToDecimal(americanOdds));
}
export function formatOdds(odds) {
    if (odds == null)
        return 'N/A';
    return odds >= 0 ? `+${odds}` : `${odds}`;
}
export function formatSpread(spread) {
    if (spread == null)
        return 'N/A';
    return spread >= 0 ? `+${spread}` : `${spread}`;
}
function parseNum(val) {
    if (val == null || val === '')
        return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}
function getOdds(entry, bookmakerID, field) {
    const bk = entry?.byBookmaker?.[bookmakerID];
    if (bk?.available !== false && bk?.[field] != null)
        return bk[field];
    // fall back to consensus
    if (field === 'odds')
        return entry?.bookOdds;
    if (field === 'spread')
        return entry?.bookSpread;
    if (field === 'overUnder')
        return entry?.bookOverUnder;
    return null;
}
export function parseEventOdds(eventOdds, bookmakerID) {
    if (!eventOdds)
        return null;
    const homeML = eventOdds['points-home-game-ml-home'];
    const awayML = eventOdds['points-away-game-ml-away'];
    const homeSP = eventOdds['points-home-game-sp-home'];
    const awaySP = eventOdds['points-away-game-sp-away'];
    const over = eventOdds['points-all-game-ou-over'];
    const under = eventOdds['points-all-game-ou-under'];
    const home_ml = parseNum(getOdds(homeML, bookmakerID, 'odds'));
    const away_ml = parseNum(getOdds(awayML, bookmakerID, 'odds'));
    const home_spread = parseNum(getOdds(homeSP, bookmakerID, 'spread'));
    const home_spread_price = parseNum(getOdds(homeSP, bookmakerID, 'odds'));
    const away_spread_price = parseNum(getOdds(awaySP, bookmakerID, 'odds'));
    const over_under = parseNum(getOdds(over, bookmakerID, 'overUnder'));
    const over_price = parseNum(getOdds(over, bookmakerID, 'odds'));
    const under_price = parseNum(getOdds(under, bookmakerID, 'odds'));
    return {
        bookmaker: bookmakerID,
        home_ml, away_ml,
        home_spread, home_spread_price, away_spread_price,
        over_under, over_price, under_price,
    };
}
