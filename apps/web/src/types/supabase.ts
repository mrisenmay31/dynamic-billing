export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          firm_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          firm_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          firm_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_runs: {
        Row: {
          billing_month: string
          created_at: string
          exception_count: number
          firm_id: string
          generated_at: string | null
          generated_by: string | null
          id: string
          invoice_count: number
          status: string
          total_amount: number | null
          trigger: string
          updated_at: string
        }
        Insert: {
          billing_month: string
          created_at?: string
          exception_count?: number
          firm_id: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          invoice_count?: number
          status?: string
          total_amount?: number | null
          trigger: string
          updated_at?: string
        }
        Update: {
          billing_month?: string
          created_at?: string
          exception_count?: number
          firm_id?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          invoice_count?: number
          status?: string
          total_amount?: number | null
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_runs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_mappings: {
        Row: {
          created_at: string
          customer_id: string
          firm_id: string
          id: string
          qb_time_source_id: string
          qb_time_source_name: string | null
          qb_time_source_type: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          firm_id: string
          id?: string
          qb_time_source_id: string
          qb_time_source_name?: string | null
          qb_time_source_type: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          firm_id?: string
          id?: string
          qb_time_source_id?: string
          qb_time_source_name?: string | null
          qb_time_source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_mappings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_mappings_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          display_name: string
          exclude_from_billing: boolean
          firm_id: string
          high_touch_buffer_minutes: number
          hourly_rate_override: number | null
          id: string
          invoice_description_override: string | null
          is_active: boolean
          is_high_touch: boolean
          qbo_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          exclude_from_billing?: boolean
          firm_id: string
          high_touch_buffer_minutes?: number
          hourly_rate_override?: number | null
          id?: string
          invoice_description_override?: string | null
          is_active?: boolean
          is_high_touch?: boolean
          qbo_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          exclude_from_billing?: boolean
          firm_id?: string
          high_touch_buffer_minutes?: number
          hourly_rate_override?: number | null
          id?: string
          invoice_description_override?: string | null
          is_active?: boolean
          is_high_touch?: boolean
          qbo_customer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_users: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          firm_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_users_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          created_at: string
          default_due_days_after_invoice: number
          default_hourly_rate: number
          default_invoice_description: string
          default_invoice_product_service: string
          id: string
          name: string
          qbo_write_enabled: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_due_days_after_invoice?: number
          default_hourly_rate?: number
          default_invoice_description?: string
          default_invoice_product_service?: string
          id?: string
          name: string
          qbo_write_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_due_days_after_invoice?: number
          default_hourly_rate?: number
          default_invoice_description?: string
          default_invoice_product_service?: string
          id?: string
          name?: string
          qbo_write_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_sync_logs: {
        Row: {
          completed_at: string | null
          error_details: Json | null
          error_message: string | null
          firm_id: string
          id: string
          integration: string
          operation: string
          records_created: number | null
          records_processed: number | null
          records_skipped: number | null
          records_updated: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          firm_id: string
          id?: string
          integration: string
          operation: string
          records_created?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          firm_id?: string
          id?: string
          integration?: string
          operation?: string
          records_created?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_logs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_drafts: {
        Row: {
          billing_run_id: string
          created_at: string
          customer_id: string
          description: string | null
          exception_reason: string | null
          firm_id: string
          high_touch_buffer_minutes: number
          hourly_rate: number
          id: string
          last_error: string | null
          qbo_idempotency_key: string | null
          qbo_invoice_id: string | null
          qbo_invoice_number: string | null
          raw_hours: number | null
          rounded_hours: number | null
          send_attempt_count: number
          sent_at: string | null
          skip_reason: string | null
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          billing_run_id: string
          created_at?: string
          customer_id: string
          description?: string | null
          exception_reason?: string | null
          firm_id: string
          high_touch_buffer_minutes?: number
          hourly_rate: number
          id?: string
          last_error?: string | null
          qbo_idempotency_key?: string | null
          qbo_invoice_id?: string | null
          qbo_invoice_number?: string | null
          raw_hours?: number | null
          rounded_hours?: number | null
          send_attempt_count?: number
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          billing_run_id?: string
          created_at?: string
          customer_id?: string
          description?: string | null
          exception_reason?: string | null
          firm_id?: string
          high_touch_buffer_minutes?: number
          hourly_rate?: number
          id?: string
          last_error?: string | null
          qbo_idempotency_key?: string | null
          qbo_invoice_id?: string | null
          qbo_invoice_number?: string | null
          raw_hours?: number | null
          rounded_hours?: number | null
          send_attempt_count?: number
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_drafts_billing_run_id_fkey"
            columns: ["billing_run_id"]
            isOneToOne: false
            referencedRelation: "billing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_drafts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_drafts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          customer_id: string | null
          firm_id: string
          id: string
          is_default: boolean
          processor: string | null
          processor_payment_method_id: string | null
          type: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          firm_id: string
          id?: string
          is_default?: boolean
          processor?: string | null
          processor_payment_method_id?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          firm_id?: string
          id?: string
          is_default?: boolean
          processor?: string | null
          processor_payment_method_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string
          firm_id: string
          id: string
          invoice_draft_id: string | null
          paid_at: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          firm_id: string
          id?: string
          invoice_draft_id?: string | null
          paid_at?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          firm_id?: string
          id?: string
          invoice_draft_id?: string | null
          paid_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_draft_id_fkey"
            columns: ["invoice_draft_id"]
            isOneToOne: false
            referencedRelation: "invoice_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      processor_transactions: {
        Row: {
          amount: number | null
          created_at: string
          fee_amount: number | null
          firm_id: string
          id: string
          payment_id: string | null
          processor: string | null
          raw_payload: Json | null
          status: string | null
          transaction_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          fee_amount?: number | null
          firm_id: string
          id?: string
          payment_id?: string | null
          processor?: string | null
          raw_payload?: Json | null
          status?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          fee_amount?: number | null
          firm_id?: string
          id?: string
          payment_id?: string | null
          processor?: string | null
          raw_payload?: Json | null
          status?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processor_transactions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processor_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      qb_time_connections: {
        Row: {
          access_token_encrypted: string | null
          connected_at: string | null
          created_at: string
          firm_id: string
          id: string
          last_refreshed_at: string | null
          refresh_token_encrypted: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          created_at?: string
          firm_id: string
          id?: string
          last_refreshed_at?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          created_at?: string
          firm_id?: string
          id?: string
          last_refreshed_at?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qb_time_connections_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: true
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_connections: {
        Row: {
          access_token_encrypted: string | null
          connected_at: string | null
          created_at: string
          firm_id: string
          id: string
          last_refreshed_at: string | null
          realm_id: string
          refresh_token_encrypted: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          created_at?: string
          firm_id: string
          id?: string
          last_refreshed_at?: string | null
          realm_id: string
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          created_at?: string
          firm_id?: string
          id?: string
          last_refreshed_at?: string | null
          realm_id?: string
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_connections_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: true
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          customer_id: string | null
          duration_seconds: number
          firm_id: string
          id: string
          imported_at: string
          is_billable: boolean
          notes: string | null
          qb_time_entry_id: string
          qb_time_jobcode_id: string | null
          qb_time_jobcode_name: string | null
          rate_used: number | null
          source_payload: Json | null
          staff_name: string | null
          started_at: string
        }
        Insert: {
          customer_id?: string | null
          duration_seconds: number
          firm_id: string
          id?: string
          imported_at?: string
          is_billable: boolean
          notes?: string | null
          qb_time_entry_id: string
          qb_time_jobcode_id?: string | null
          qb_time_jobcode_name?: string | null
          rate_used?: number | null
          source_payload?: Json | null
          staff_name?: string | null
          started_at: string
        }
        Update: {
          customer_id?: string | null
          duration_seconds?: number
          firm_id?: string
          id?: string
          imported_at?: string
          is_billable?: boolean
          notes?: string | null
          qb_time_entry_id?: string
          qb_time_jobcode_id?: string | null
          qb_time_jobcode_name?: string | null
          rate_used?: number | null
          source_payload?: Json | null
          staff_name?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          firm_id: string | null
          id: string
          payload: Json | null
          processed: boolean
          processed_at: string | null
          source: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          firm_id?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          source: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          firm_id?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
