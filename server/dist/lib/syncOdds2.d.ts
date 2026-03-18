export declare function syncOdds2(): Promise<{
    upserted: number;
    total: number;
    error: string;
} | {
    upserted: number;
    total: number;
    error?: undefined;
}>;
