import type { Database } from './types';
export declare function createServiceClient(): import("@supabase/supabase-js").SupabaseClient<Database, "public", "public", {
    Tables: {
        bets: {
            Row: {
                amount: number;
                game_id: string;
                id: string;
                market: string;
                odds_at_place: number;
                payout: number | null;
                pick: string;
                placed_at: string;
                result: string | null;
                settled_at: string | null;
                user_id: string;
            };
            Insert: {
                amount: number;
                game_id: string;
                id?: string;
                market: string;
                odds_at_place: number;
                payout?: number | null;
                pick: string;
                placed_at?: string;
                result?: string | null;
                settled_at?: string | null;
                user_id: string;
            };
            Update: {
                amount?: number;
                game_id?: string;
                id?: string;
                market?: string;
                odds_at_place?: number;
                payout?: number | null;
                pick?: string;
                placed_at?: string;
                result?: string | null;
                settled_at?: string | null;
                user_id?: string;
            };
            Relationships: [{
                foreignKeyName: "bets_game_id_fkey";
                columns: ["game_id"];
                isOneToOne: false;
                referencedRelation: "games";
                referencedColumns: ["id"];
            }, {
                foreignKeyName: "bets_user_id_fkey";
                columns: ["user_id"];
                isOneToOne: false;
                referencedRelation: "profiles";
                referencedColumns: ["id"];
            }];
        };
        games: {
            Row: {
                away_score: number | null;
                away_team: string;
                created_at: string;
                game_date: string;
                home_score: number | null;
                home_team: string;
                id: string;
                ncaa_game_id: string;
                network: string | null;
                start_time: string;
                status: string;
                updated_at: string;
            };
            Insert: {
                away_score?: number | null;
                away_team: string;
                created_at?: string;
                game_date: string;
                home_score?: number | null;
                home_team: string;
                id?: string;
                ncaa_game_id: string;
                network?: string | null;
                start_time: string;
                status?: string;
                updated_at?: string;
            };
            Update: {
                away_score?: number | null;
                away_team?: string;
                created_at?: string;
                game_date?: string;
                home_score?: number | null;
                home_team?: string;
                id?: string;
                ncaa_game_id?: string;
                network?: string | null;
                start_time?: string;
                status?: string;
                updated_at?: string;
            };
            Relationships: [];
        };
        odds: {
            Row: {
                away_ml: number | null;
                away_spread_price: number | null;
                bookmaker: string;
                fetched_at: string;
                game_id: string;
                home_ml: number | null;
                home_spread: number | null;
                home_spread_price: number | null;
                id: string;
                over_price: number | null;
                over_under: number | null;
                under_price: number | null;
            };
            Insert: {
                away_ml?: number | null;
                away_spread_price?: number | null;
                bookmaker?: string;
                fetched_at?: string;
                game_id: string;
                home_ml?: number | null;
                home_spread?: number | null;
                home_spread_price?: number | null;
                id?: string;
                over_price?: number | null;
                over_under?: number | null;
                under_price?: number | null;
            };
            Update: {
                away_ml?: number | null;
                away_spread_price?: number | null;
                bookmaker?: string;
                fetched_at?: string;
                game_id?: string;
                home_ml?: number | null;
                home_spread?: number | null;
                home_spread_price?: number | null;
                id?: string;
                over_price?: number | null;
                over_under?: number | null;
                under_price?: number | null;
            };
            Relationships: [{
                foreignKeyName: "odds_game_id_fkey";
                columns: ["game_id"];
                isOneToOne: false;
                referencedRelation: "games";
                referencedColumns: ["id"];
            }];
        };
        profiles: {
            Row: {
                balance: number;
                created_at: string;
                id: string;
                username: string;
            };
            Insert: {
                balance?: number;
                created_at?: string;
                id: string;
                username: string;
            };
            Update: {
                balance?: number;
                created_at?: string;
                id?: string;
                username?: string;
            };
            Relationships: [];
        };
    };
    Views: { [_ in never]: never; };
    Functions: { [_ in never]: never; };
    Enums: { [_ in never]: never; };
    CompositeTypes: { [_ in never]: never; };
}, {
    PostgrestVersion: "14.4";
}>;
export declare function createAnonClient(): import("@supabase/supabase-js").SupabaseClient<Database, "public", "public", {
    Tables: {
        bets: {
            Row: {
                amount: number;
                game_id: string;
                id: string;
                market: string;
                odds_at_place: number;
                payout: number | null;
                pick: string;
                placed_at: string;
                result: string | null;
                settled_at: string | null;
                user_id: string;
            };
            Insert: {
                amount: number;
                game_id: string;
                id?: string;
                market: string;
                odds_at_place: number;
                payout?: number | null;
                pick: string;
                placed_at?: string;
                result?: string | null;
                settled_at?: string | null;
                user_id: string;
            };
            Update: {
                amount?: number;
                game_id?: string;
                id?: string;
                market?: string;
                odds_at_place?: number;
                payout?: number | null;
                pick?: string;
                placed_at?: string;
                result?: string | null;
                settled_at?: string | null;
                user_id?: string;
            };
            Relationships: [{
                foreignKeyName: "bets_game_id_fkey";
                columns: ["game_id"];
                isOneToOne: false;
                referencedRelation: "games";
                referencedColumns: ["id"];
            }, {
                foreignKeyName: "bets_user_id_fkey";
                columns: ["user_id"];
                isOneToOne: false;
                referencedRelation: "profiles";
                referencedColumns: ["id"];
            }];
        };
        games: {
            Row: {
                away_score: number | null;
                away_team: string;
                created_at: string;
                game_date: string;
                home_score: number | null;
                home_team: string;
                id: string;
                ncaa_game_id: string;
                network: string | null;
                start_time: string;
                status: string;
                updated_at: string;
            };
            Insert: {
                away_score?: number | null;
                away_team: string;
                created_at?: string;
                game_date: string;
                home_score?: number | null;
                home_team: string;
                id?: string;
                ncaa_game_id: string;
                network?: string | null;
                start_time: string;
                status?: string;
                updated_at?: string;
            };
            Update: {
                away_score?: number | null;
                away_team?: string;
                created_at?: string;
                game_date?: string;
                home_score?: number | null;
                home_team?: string;
                id?: string;
                ncaa_game_id?: string;
                network?: string | null;
                start_time?: string;
                status?: string;
                updated_at?: string;
            };
            Relationships: [];
        };
        odds: {
            Row: {
                away_ml: number | null;
                away_spread_price: number | null;
                bookmaker: string;
                fetched_at: string;
                game_id: string;
                home_ml: number | null;
                home_spread: number | null;
                home_spread_price: number | null;
                id: string;
                over_price: number | null;
                over_under: number | null;
                under_price: number | null;
            };
            Insert: {
                away_ml?: number | null;
                away_spread_price?: number | null;
                bookmaker?: string;
                fetched_at?: string;
                game_id: string;
                home_ml?: number | null;
                home_spread?: number | null;
                home_spread_price?: number | null;
                id?: string;
                over_price?: number | null;
                over_under?: number | null;
                under_price?: number | null;
            };
            Update: {
                away_ml?: number | null;
                away_spread_price?: number | null;
                bookmaker?: string;
                fetched_at?: string;
                game_id?: string;
                home_ml?: number | null;
                home_spread?: number | null;
                home_spread_price?: number | null;
                id?: string;
                over_price?: number | null;
                over_under?: number | null;
                under_price?: number | null;
            };
            Relationships: [{
                foreignKeyName: "odds_game_id_fkey";
                columns: ["game_id"];
                isOneToOne: false;
                referencedRelation: "games";
                referencedColumns: ["id"];
            }];
        };
        profiles: {
            Row: {
                balance: number;
                created_at: string;
                id: string;
                username: string;
            };
            Insert: {
                balance?: number;
                created_at?: string;
                id: string;
                username: string;
            };
            Update: {
                balance?: number;
                created_at?: string;
                id?: string;
                username?: string;
            };
            Relationships: [];
        };
    };
    Views: { [_ in never]: never; };
    Functions: { [_ in never]: never; };
    Enums: { [_ in never]: never; };
    CompositeTypes: { [_ in never]: never; };
}, {
    PostgrestVersion: "14.4";
}>;
/**
 * Create a Supabase client authenticated with the user's JWT.
 * The JWT comes from the sb-access-token cookie or Authorization header.
 */
export declare function createUserClient(accessToken: string): import("@supabase/supabase-js").SupabaseClient<Database, "public", "public", {
    Tables: {
        bets: {
            Row: {
                amount: number;
                game_id: string;
                id: string;
                market: string;
                odds_at_place: number;
                payout: number | null;
                pick: string;
                placed_at: string;
                result: string | null;
                settled_at: string | null;
                user_id: string;
            };
            Insert: {
                amount: number;
                game_id: string;
                id?: string;
                market: string;
                odds_at_place: number;
                payout?: number | null;
                pick: string;
                placed_at?: string;
                result?: string | null;
                settled_at?: string | null;
                user_id: string;
            };
            Update: {
                amount?: number;
                game_id?: string;
                id?: string;
                market?: string;
                odds_at_place?: number;
                payout?: number | null;
                pick?: string;
                placed_at?: string;
                result?: string | null;
                settled_at?: string | null;
                user_id?: string;
            };
            Relationships: [{
                foreignKeyName: "bets_game_id_fkey";
                columns: ["game_id"];
                isOneToOne: false;
                referencedRelation: "games";
                referencedColumns: ["id"];
            }, {
                foreignKeyName: "bets_user_id_fkey";
                columns: ["user_id"];
                isOneToOne: false;
                referencedRelation: "profiles";
                referencedColumns: ["id"];
            }];
        };
        games: {
            Row: {
                away_score: number | null;
                away_team: string;
                created_at: string;
                game_date: string;
                home_score: number | null;
                home_team: string;
                id: string;
                ncaa_game_id: string;
                network: string | null;
                start_time: string;
                status: string;
                updated_at: string;
            };
            Insert: {
                away_score?: number | null;
                away_team: string;
                created_at?: string;
                game_date: string;
                home_score?: number | null;
                home_team: string;
                id?: string;
                ncaa_game_id: string;
                network?: string | null;
                start_time: string;
                status?: string;
                updated_at?: string;
            };
            Update: {
                away_score?: number | null;
                away_team?: string;
                created_at?: string;
                game_date?: string;
                home_score?: number | null;
                home_team?: string;
                id?: string;
                ncaa_game_id?: string;
                network?: string | null;
                start_time?: string;
                status?: string;
                updated_at?: string;
            };
            Relationships: [];
        };
        odds: {
            Row: {
                away_ml: number | null;
                away_spread_price: number | null;
                bookmaker: string;
                fetched_at: string;
                game_id: string;
                home_ml: number | null;
                home_spread: number | null;
                home_spread_price: number | null;
                id: string;
                over_price: number | null;
                over_under: number | null;
                under_price: number | null;
            };
            Insert: {
                away_ml?: number | null;
                away_spread_price?: number | null;
                bookmaker?: string;
                fetched_at?: string;
                game_id: string;
                home_ml?: number | null;
                home_spread?: number | null;
                home_spread_price?: number | null;
                id?: string;
                over_price?: number | null;
                over_under?: number | null;
                under_price?: number | null;
            };
            Update: {
                away_ml?: number | null;
                away_spread_price?: number | null;
                bookmaker?: string;
                fetched_at?: string;
                game_id?: string;
                home_ml?: number | null;
                home_spread?: number | null;
                home_spread_price?: number | null;
                id?: string;
                over_price?: number | null;
                over_under?: number | null;
                under_price?: number | null;
            };
            Relationships: [{
                foreignKeyName: "odds_game_id_fkey";
                columns: ["game_id"];
                isOneToOne: false;
                referencedRelation: "games";
                referencedColumns: ["id"];
            }];
        };
        profiles: {
            Row: {
                balance: number;
                created_at: string;
                id: string;
                username: string;
            };
            Insert: {
                balance?: number;
                created_at?: string;
                id: string;
                username: string;
            };
            Update: {
                balance?: number;
                created_at?: string;
                id?: string;
                username?: string;
            };
            Relationships: [];
        };
    };
    Views: { [_ in never]: never; };
    Functions: { [_ in never]: never; };
    Enums: { [_ in never]: never; };
    CompositeTypes: { [_ in never]: never; };
}, {
    PostgrestVersion: "14.4";
}>;
