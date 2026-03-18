export declare function americanToDecimal(american: number): number;
export declare function calculatePayout(stake: number, americanOdds: number): number;
export declare function formatOdds(odds: number | null | undefined): string;
export declare function formatSpread(spread: number | null | undefined): string;
type ByBookmakerEntry = {
    odds?: string | null;
    spread?: string | null;
    overUnder?: string | null;
    available?: boolean;
};
type OddEntry = {
    bookOdds?: string | null;
    bookSpread?: string | null;
    bookOverUnder?: string | null;
    byBookmaker?: Record<string, ByBookmakerEntry>;
};
type EventOddsMap = Record<string, OddEntry>;
export declare function parseEventOdds(eventOdds: EventOddsMap, bookmakerID: string): {
    bookmaker: string;
    home_ml: number | null;
    away_ml: number | null;
    home_spread: number | null;
    home_spread_price: number | null;
    away_spread_price: number | null;
    over_under: number | null;
    over_price: number | null;
    under_price: number | null;
} | null;
export {};
