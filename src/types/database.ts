// Generated from Supabase schema — run `supabase gen types typescript` to regenerate

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          type:
            | "restaurant"
            | "cafe"
            | "retail"
            | "pharmacy"
            | "salon"
            | "food_truck"
            | "other"
            | null;
          country: string;
          currency: string;
          timezone: string;
          plan: "starter" | "growth" | "pro";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_subscription_status: string | null;
          scans_used_this_month: number;
          scan_limit: number;
          scan_reset_at: string;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          type?: string | null;
          country?: string;
          currency?: string;
          timezone?: string;
          plan?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_subscription_status?: string | null;
          scans_used_this_month?: number;
          scan_limit?: number;
          scan_reset_at?: string;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          type?: string | null;
          country?: string;
          currency?: string;
          timezone?: string;
          plan?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_subscription_status?: string | null;
          scans_used_this_month?: number;
          scan_limit?: number;
          scan_reset_at?: string;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          category: string | null;
          unit: string | null;
          current_quantity: number;
          low_stock_threshold: number | null;
          preferred_supplier_id: string | null;
          last_unit_price: number | null;
          avg_unit_price: number | null;
          square_item_id: string | null;
          square_location_id: string | null;
          clover_item_id: string | null;
          lightspeed_item_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          category?: string | null;
          unit?: string | null;
          current_quantity?: number;
          low_stock_threshold?: number | null;
          preferred_supplier_id?: string | null;
          last_unit_price?: number | null;
          avg_unit_price?: number | null;
          square_item_id?: string | null;
          square_location_id?: string | null;
          clover_item_id?: string | null;
          lightspeed_item_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          category?: string | null;
          unit?: string | null;
          current_quantity?: number;
          low_stock_threshold?: number | null;
          preferred_supplier_id?: string | null;
          last_unit_price?: number | null;
          avg_unit_price?: number | null;
          square_item_id?: string | null;
          square_location_id?: string | null;
          clover_item_id?: string | null;
          lightspeed_item_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scans: {
        Row: {
          id: string;
          business_id: string;
          supplier_id: string | null;
          invoice_number: string | null;
          scan_date: string;
          total_amount: number | null;
          currency: string | null;
          item_count: number;
          ai_confidence: number | null;
          manually_corrected: boolean;
          entry_source: "ai_scan" | "manual" | "template_reuse" | "pos_import";
          status: "pending" | "confirmed" | "failed";
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          supplier_id?: string | null;
          invoice_number?: string | null;
          scan_date?: string;
          total_amount?: number | null;
          currency?: string | null;
          item_count?: number;
          ai_confidence?: number | null;
          manually_corrected?: boolean;
          entry_source?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          supplier_id?: string | null;
          invoice_number?: string | null;
          scan_date?: string;
          total_amount?: number | null;
          currency?: string | null;
          item_count?: number;
          ai_confidence?: number | null;
          manually_corrected?: boolean;
          entry_source?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      scan_items: {
        Row: {
          id: string;
          scan_id: string;
          item_id: string | null;
          item_name_raw: string;
          quantity: number;
          unit: string | null;
          unit_price: number | null;
          total_price: number | null;
          was_new_item: boolean;
          match_type: "exact" | "fuzzy" | "manual" | "new" | null;
        };
        Insert: {
          id?: string;
          scan_id: string;
          item_id?: string | null;
          item_name_raw: string;
          quantity: number;
          unit?: string | null;
          unit_price?: number | null;
          total_price?: number | null;
          was_new_item?: boolean;
          match_type?: string | null;
        };
        Update: {
          id?: string;
          scan_id?: string;
          item_id?: string | null;
          item_name_raw?: string;
          quantity?: number;
          unit?: string | null;
          unit_price?: number | null;
          total_price?: number | null;
          was_new_item?: boolean;
          match_type?: string | null;
        };
        Relationships: [];
      };
      pos_connections: {
        Row: {
          id: string;
          business_id: string;
          pos_type: "square" | "clover" | "lightspeed" | "toast";
          merchant_id: string;
          location_id: string | null;
          access_token_enc: string;
          refresh_token_enc: string | null;
          token_expires_at: string | null;
          scopes: string[] | null;
          last_sync_at: string | null;
          last_sync_status:
            | "never"
            | "syncing"
            | "success"
            | "partial"
            | "failed";
          last_error_message: string | null;
          catalog_synced_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          pos_type: string;
          merchant_id: string;
          location_id?: string | null;
          access_token_enc: string;
          refresh_token_enc?: string | null;
          token_expires_at?: string | null;
          scopes?: string[] | null;
          last_sync_at?: string | null;
          last_sync_status?: string;
          last_error_message?: string | null;
          catalog_synced_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          pos_type?: string;
          merchant_id?: string;
          location_id?: string | null;
          access_token_enc?: string;
          refresh_token_enc?: string | null;
          token_expires_at?: string | null;
          scopes?: string[] | null;
          last_sync_at?: string | null;
          last_sync_status?: string;
          last_error_message?: string | null;
          catalog_synced_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_audit_log: {
        Row: {
          id: string;
          business_id: string;
          item_id: string | null;
          item_name: string;
          change_type:
            | "scan_add"
            | "manual_add"
            | "manual_edit"
            | "manual_delete"
            | "pos_sale_deduct"
            | "pos_sync_adjust"
            | "pos_catalog_create"
            | "system_reset";
          quantity_before: number | null;
          quantity_change: number;
          quantity_after: number;
          source_ref: string | null;
          source_pos: string | null;
          notes: string | null;
          performed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          item_id?: string | null;
          item_name: string;
          change_type: string;
          quantity_before?: number | null;
          quantity_change: number;
          quantity_after: number;
          source_ref?: string | null;
          source_pos?: string | null;
          notes?: string | null;
          performed_by?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          business_id: string;
          type: "low_stock" | "pos_error" | "scan_failed" | "billing";
          title: string;
          message: string;
          metadata: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          type: string;
          title: string;
          message: string;
          metadata?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          type?: string;
          title?: string;
          message?: string;
          metadata?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_scan: {
        Args: {
          p_business_id: string;
          p_supplier_id: string | null;
          p_invoice_number: string | null;
          p_scan_date: string;
          p_total_amount: number | null;
          p_ai_confidence: number | null;
          p_manually_corrected: boolean;
          p_entry_source: string;
          p_items: Json;
        };
        Returns: Json;
      };
      update_item_quantity_pos: {
        Args: {
          p_item_id: string;
          p_business_id: string;
          p_new_quantity: number;
          p_source_pos: string;
          p_source_ref: string;
          p_change_type: string;
        };
        Returns: Json;
      };
      vault_encrypt_token: {
        Args: { plaintext_token: string };
        Returns: string;
      };
      vault_decrypt_token: {
        Args: { encrypted_token: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
