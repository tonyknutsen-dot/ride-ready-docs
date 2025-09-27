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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      annual_inspection_reports: {
        Row: {
          certificate_number: string | null
          conditions_notes: string | null
          created_at: string
          id: string
          inspection_company: string
          inspection_date: string
          inspection_status: string
          inspection_year: number
          inspector_name: string
          next_inspection_due: string | null
          recommendations: string | null
          report_file_path: string | null
          ride_id: string
          user_id: string
        }
        Insert: {
          certificate_number?: string | null
          conditions_notes?: string | null
          created_at?: string
          id?: string
          inspection_company: string
          inspection_date: string
          inspection_status: string
          inspection_year: number
          inspector_name: string
          next_inspection_due?: string | null
          recommendations?: string | null
          report_file_path?: string | null
          ride_id: string
          user_id: string
        }
        Update: {
          certificate_number?: string | null
          conditions_notes?: string | null
          created_at?: string
          id?: string
          inspection_company?: string
          inspection_date?: string
          inspection_status?: string
          inspection_year?: number
          inspector_name?: string
          next_inspection_due?: string | null
          recommendations?: string | null
          report_file_path?: string | null
          ride_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "annual_inspection_reports_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      check_item_library: {
        Row: {
          category: string
          check_item_text: string
          created_at: string
          description: string | null
          id: string
          is_required: boolean | null
          sort_order: number | null
        }
        Insert: {
          category: string
          check_item_text: string
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
        }
        Update: {
          category?: string
          check_item_text?: string
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
        }
        Relationships: []
      }
      compliance_templates: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          jurisdiction: string
          requirements: Json
          template_name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          jurisdiction: string
          requirements: Json
          template_name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          jurisdiction?: string
          requirements?: Json
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_check_template_items: {
        Row: {
          category: string | null
          check_item_text: string
          created_at: string
          id: string
          is_required: boolean | null
          sort_order: number | null
          template_id: string
        }
        Insert: {
          category?: string | null
          check_item_text: string
          created_at?: string
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
          template_id: string
        }
        Update: {
          category?: string | null
          check_item_text?: string
          created_at?: string
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_check_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "daily_check_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_check_templates: {
        Row: {
          check_frequency: string
          created_at: string
          custom_interval_days: number | null
          description: string | null
          id: string
          is_active: boolean | null
          ride_id: string
          template_name: string
          template_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          check_frequency?: string
          created_at?: string
          custom_interval_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          ride_id: string
          template_name: string
          template_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          check_frequency?: string
          created_at?: string
          custom_interval_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          ride_id?: string
          template_name?: string
          template_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_check_templates_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          document_name: string
          document_type: string
          expires_at: string | null
          file_path: string
          file_size: number | null
          id: string
          is_global: boolean | null
          is_latest_version: boolean | null
          mime_type: string | null
          notes: string | null
          replaced_document_id: string | null
          ride_id: string | null
          uploaded_at: string
          user_id: string
          version_notes: string | null
          version_number: string | null
        }
        Insert: {
          document_name: string
          document_type: string
          expires_at?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          is_global?: boolean | null
          is_latest_version?: boolean | null
          mime_type?: string | null
          notes?: string | null
          replaced_document_id?: string | null
          ride_id?: string | null
          uploaded_at?: string
          user_id: string
          version_notes?: string | null
          version_number?: string | null
        }
        Update: {
          document_name?: string
          document_type?: string
          expires_at?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          is_global?: boolean | null
          is_latest_version?: boolean | null
          mime_type?: string | null
          notes?: string | null
          replaced_document_id?: string | null
          ride_id?: string | null
          uploaded_at?: string
          user_id?: string
          version_notes?: string | null
          version_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_replaced_document_id_fkey"
            columns: ["replaced_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_check_results: {
        Row: {
          created_at: string
          id: string
          inspection_check_id: string
          is_checked: boolean
          notes: string | null
          template_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_check_id: string
          is_checked: boolean
          notes?: string | null
          template_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_check_id?: string
          is_checked?: boolean
          notes?: string | null
          template_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_check_results_daily_check_id_fkey"
            columns: ["inspection_check_id"]
            isOneToOne: false
            referencedRelation: "inspection_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_check_results_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "daily_check_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_checks: {
        Row: {
          check_date: string
          check_frequency: string
          created_at: string
          id: string
          inspector_name: string
          notes: string | null
          ride_id: string
          status: string
          template_id: string
          user_id: string
        }
        Insert: {
          check_date?: string
          check_frequency?: string
          created_at?: string
          id?: string
          inspector_name: string
          notes?: string | null
          ride_id: string
          status: string
          template_id: string
          user_id: string
        }
        Update: {
          check_date?: string
          check_frequency?: string
          created_at?: string
          id?: string
          inspector_name?: string
          notes?: string | null
          ride_id?: string
          status?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checks_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_checks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "daily_check_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          cost: number | null
          created_at: string
          description: string
          document_ids: string[] | null
          id: string
          maintenance_date: string
          maintenance_type: string
          next_maintenance_due: string | null
          notes: string | null
          parts_replaced: string | null
          performed_by: string | null
          ride_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description: string
          document_ids?: string[] | null
          id?: string
          maintenance_date: string
          maintenance_type: string
          next_maintenance_due?: string | null
          notes?: string | null
          parts_replaced?: string | null
          performed_by?: string | null
          ride_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string
          document_ids?: string[] | null
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          next_maintenance_due?: string | null
          notes?: string | null
          parts_replaced?: string | null
          performed_by?: string | null
          ride_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ndt_reports: {
        Row: {
          certificate_number: string | null
          component_tested: string
          created_at: string
          defects_found: string | null
          id: string
          inspection_company: string | null
          inspection_date: string
          inspector_name: string
          ndt_method: string
          ndt_schedule_id: string
          next_inspection_due: string | null
          recommendations: string | null
          report_file_path: string | null
          ride_id: string
          test_results: string
          user_id: string
        }
        Insert: {
          certificate_number?: string | null
          component_tested: string
          created_at?: string
          defects_found?: string | null
          id?: string
          inspection_company?: string | null
          inspection_date: string
          inspector_name: string
          ndt_method: string
          ndt_schedule_id: string
          next_inspection_due?: string | null
          recommendations?: string | null
          report_file_path?: string | null
          ride_id: string
          test_results: string
          user_id: string
        }
        Update: {
          certificate_number?: string | null
          component_tested?: string
          created_at?: string
          defects_found?: string | null
          id?: string
          inspection_company?: string | null
          inspection_date?: string
          inspector_name?: string
          ndt_method?: string
          ndt_schedule_id?: string
          next_inspection_due?: string | null
          recommendations?: string | null
          report_file_path?: string | null
          ride_id?: string
          test_results?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ndt_reports_ndt_schedule_id_fkey"
            columns: ["ndt_schedule_id"]
            isOneToOne: false
            referencedRelation: "ndt_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ndt_reports_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ndt_schedules: {
        Row: {
          component_description: string
          created_at: string
          frequency_months: number
          id: string
          is_active: boolean | null
          last_inspection_date: string | null
          ndt_method: string
          next_inspection_due: string | null
          notes: string | null
          ride_id: string
          schedule_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          component_description: string
          created_at?: string
          frequency_months: number
          id?: string
          is_active?: boolean | null
          last_inspection_date?: string | null
          ndt_method: string
          next_inspection_due?: string | null
          notes?: string | null
          ride_id: string
          schedule_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          component_description?: string
          created_at?: string
          frequency_months?: number
          id?: string
          is_active?: boolean | null
          last_inspection_date?: string | null
          ndt_method?: string
          next_inspection_due?: string | null
          notes?: string | null
          ride_id?: string
          schedule_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ndt_schedules_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          related_table: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          related_table?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          related_table?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          company_name: string | null
          controller_name: string | null
          created_at: string
          id: string
          showmen_name: string | null
          subscription_plan: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          controller_name?: string | null
          created_at?: string
          id?: string
          showmen_name?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          controller_name?: string | null
          created_at?: string
          id?: string
          showmen_name?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ride_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          category_id: string
          created_at: string
          id: string
          manufacturer: string | null
          ride_name: string
          serial_number: string | null
          updated_at: string
          user_id: string
          year_manufactured: number | null
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          manufacturer?: string | null
          ride_name: string
          serial_number?: string | null
          updated_at?: string
          user_id: string
          year_manufactured?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          manufacturer?: string | null
          ride_name?: string
          serial_number?: string | null
          updated_at?: string
          user_id?: string
          year_manufactured?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ride_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_bulletins: {
        Row: {
          bulletin_number: string | null
          category_id: string
          content: string | null
          created_at: string
          id: string
          issue_date: string | null
          priority: string | null
          title: string
        }
        Insert: {
          bulletin_number?: string | null
          category_id: string
          content?: string | null
          created_at?: string
          id?: string
          issue_date?: string | null
          priority?: string | null
          title: string
        }
        Update: {
          bulletin_number?: string | null
          category_id?: string
          content?: string | null
          created_at?: string
          id?: string
          issue_date?: string | null
          priority?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_bulletins_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ride_categories"
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
  public: {
    Enums: {},
  },
} as const
