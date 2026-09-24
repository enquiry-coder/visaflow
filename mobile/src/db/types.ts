/**
 * Database types — GENERATED from supabase/migrations. Do not edit by hand.
 *
 * Regenerated whenever a migration is added, so this always matches what is actually in the
 * database. Anything written here by hand is lost on the next migration.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          user_id: string;
          reg_no: string;
          first_name: string;
          last_name: string;
          phone: string;
          handling_staff: string;
          status: string;
          passport_url: string | null;
          address_proof_url: string | null;
          preferred_date: string | null;
          preferred_time: string | null;
          zoom_link: string | null;
          capture_url: string | null;
          created_at: string;
          updated_at: string;
          salutation: string | null;
          nationality: string | null;
          completed_at: string | null;
          follow_up_due: boolean;
          confirmed_time: string | null;
          confirmed_date: string | null;
          country_code: string | null;
          phone_number: string | null;
          submitted_at: string | null;
          invited_at: string | null;
          passport_clarity: string | null;
          address_clarity: string | null;
          docs_verified_at: string | null;
        };
        Insert: {
          id: string;
          user_id?: string;
          reg_no: string;
          first_name: string;
          last_name: string;
          phone: string;
          handling_staff: string;
          status?: string;
          passport_url?: string | null;
          address_proof_url?: string | null;
          preferred_date?: string | null;
          preferred_time?: string | null;
          zoom_link?: string | null;
          capture_url?: string | null;
          created_at?: string;
          updated_at?: string;
          salutation?: string | null;
          nationality?: string | null;
          completed_at?: string | null;
          follow_up_due?: boolean;
          confirmed_time?: string | null;
          confirmed_date?: string | null;
          country_code?: string | null;
          phone_number?: string | null;
          submitted_at?: string | null;
          invited_at?: string | null;
          passport_clarity?: string | null;
          address_clarity?: string | null;
          docs_verified_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          reg_no?: string;
          first_name?: string;
          last_name?: string;
          phone?: string;
          handling_staff?: string;
          status?: string;
          passport_url?: string | null;
          address_proof_url?: string | null;
          preferred_date?: string | null;
          preferred_time?: string | null;
          zoom_link?: string | null;
          capture_url?: string | null;
          created_at?: string;
          updated_at?: string;
          salutation?: string | null;
          nationality?: string | null;
          completed_at?: string | null;
          follow_up_due?: boolean;
          confirmed_time?: string | null;
          confirmed_date?: string | null;
          country_code?: string | null;
          phone_number?: string | null;
          submitted_at?: string | null;
          invited_at?: string | null;
          passport_clarity?: string | null;
          address_clarity?: string | null;
          docs_verified_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Client = Database['public']['Tables']['clients']['Row'];
