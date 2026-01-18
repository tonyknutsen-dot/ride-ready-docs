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
      blocked_ips: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          city: string | null
          country_code: string | null
          country_name: string | null
          created_at: string
          expires_at: string
          id: string
          ip_address: string
          is_active: boolean
          isp: string | null
          reason: string
          region: string | null
          request_count: number | null
          unblock_token: string | null
          unblocked_at: string | null
          unblocked_by: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          city?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          expires_at: string
          id?: string
          ip_address: string
          is_active?: boolean
          isp?: string | null
          reason: string
          region?: string | null
          request_count?: number | null
          unblock_token?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          city?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string
          is_active?: boolean
          isp?: string | null
          reason?: string
          region?: string | null
          request_count?: number | null
          unblock_token?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Relationships: []
      }
      bug_report_admin_data: {
        Row: {
          assigned_to: string | null
          bug_report_id: string
          created_at: string
          id: string
          internal_notes: string | null
          priority: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          bug_report_id: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          priority?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          bug_report_id?: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          priority?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_report_admin_data_bug_report_id_fkey"
            columns: ["bug_report_id"]
            isOneToOne: true
            referencedRelation: "bug_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          actual_result: string | null
          app_name: string | null
          app_version: string | null
          browser_info: string | null
          build_date: string | null
          captured_at: string
          created_at: string
          current_route: string | null
          description: string
          device_type: string | null
          expected_result: string | null
          id: string
          is_after_recent_changes: boolean | null
          issue_type: string
          reference_id: string
          screenshot_url: string | null
          severity: string
          status: string
          steps_to_reproduce: string | null
          title: string
          updated_at: string
          user_id: string
          user_role: string | null
        }
        Insert: {
          actual_result?: string | null
          app_name?: string | null
          app_version?: string | null
          browser_info?: string | null
          build_date?: string | null
          captured_at?: string
          created_at?: string
          current_route?: string | null
          description: string
          device_type?: string | null
          expected_result?: string | null
          id?: string
          is_after_recent_changes?: boolean | null
          issue_type?: string
          reference_id: string
          screenshot_url?: string | null
          severity?: string
          status?: string
          steps_to_reproduce?: string | null
          title: string
          updated_at?: string
          user_id: string
          user_role?: string | null
        }
        Update: {
          actual_result?: string | null
          app_name?: string | null
          app_version?: string | null
          browser_info?: string | null
          build_date?: string | null
          captured_at?: string
          created_at?: string
          current_route?: string | null
          description?: string
          device_type?: string | null
          expected_result?: string | null
          id?: string
          is_after_recent_changes?: boolean | null
          issue_type?: string
          reference_id?: string
          screenshot_url?: string | null
          severity?: string
          status?: string
          steps_to_reproduce?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          user_role?: string | null
        }
        Relationships: []
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
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
      check_library_items: {
        Row: {
          created_at: string
          frequency: Database["public"]["Enums"]["check_frequency"]
          hint: string | null
          id: string
          is_active: boolean
          label: string
          ride_category_id: string | null
          risk_level: string | null
          sort_index: number
        }
        Insert: {
          created_at?: string
          frequency: Database["public"]["Enums"]["check_frequency"]
          hint?: string | null
          id?: string
          is_active?: boolean
          label: string
          ride_category_id?: string | null
          risk_level?: string | null
          sort_index?: number
        }
        Update: {
          created_at?: string
          frequency?: Database["public"]["Enums"]["check_frequency"]
          hint?: string | null
          id?: string
          is_active?: boolean
          label?: string
          ride_category_id?: string | null
          risk_level?: string | null
          sort_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "check_library_items_ride_category_id_fkey"
            columns: ["ride_category_id"]
            isOneToOne: false
            referencedRelation: "ride_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      check_results: {
        Row: {
          check_id: string
          created_at: string
          id: string
          is_checked: boolean
          notes: string | null
          template_item_id: string
        }
        Insert: {
          check_id: string
          created_at?: string
          id?: string
          is_checked: boolean
          notes?: string | null
          template_item_id: string
        }
        Update: {
          check_id?: string
          created_at?: string
          id?: string
          is_checked?: boolean
          notes?: string | null
          template_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_check_results_daily_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "checks"
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
      checks: {
        Row: {
          check_date: string
          check_frequency: string
          compliance_officer: string | null
          created_at: string
          environment_notes: string | null
          id: string
          inspector_name: string
          is_test_data: boolean
          notes: string | null
          ride_id: string
          signature_data: string | null
          status: string
          template_id: string
          user_id: string
          weather_conditions: string | null
        }
        Insert: {
          check_date?: string
          check_frequency?: string
          compliance_officer?: string | null
          created_at?: string
          environment_notes?: string | null
          id?: string
          inspector_name: string
          is_test_data?: boolean
          notes?: string | null
          ride_id: string
          signature_data?: string | null
          status: string
          template_id: string
          user_id: string
          weather_conditions?: string | null
        }
        Update: {
          check_date?: string
          check_frequency?: string
          compliance_officer?: string | null
          created_at?: string
          environment_notes?: string | null
          id?: string
          inspector_name?: string
          is_test_data?: boolean
          notes?: string | null
          ride_id?: string
          signature_data?: string | null
          status?: string
          template_id?: string
          user_id?: string
          weather_conditions?: string | null
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
          is_archived: boolean
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
          is_archived?: boolean
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
          is_archived?: boolean
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
      document_ride_assignments: {
        Row: {
          assigned_at: string
          document_id: string
          id: string
          notes: string | null
          ride_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          document_id: string
          id?: string
          notes?: string | null
          ride_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          document_id?: string
          id?: string
          notes?: string | null
          ride_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_ride_assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_ride_assignments_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      document_type_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          document_type_name: string
          id: string
          justification: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          document_type_name: string
          id?: string
          justification?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          document_type_name?: string
          id?: string
          justification?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          is_test_data: boolean
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
          is_test_data?: boolean
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
          is_test_data?: boolean
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
      email_campaigns: {
        Row: {
          created_at: string
          html_content: string
          id: string
          name: string
          recipient_count: number | null
          scheduled_for: string | null
          sent_at: string | null
          sent_count: number | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          html_content: string
          id?: string
          name: string
          recipient_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          html_content?: string
          id?: string
          name?: string
          recipient_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          message_body: string
          name: string
          recipient_type: string | null
          subject_line: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          message_body: string
          name: string
          recipient_type?: string | null
          subject_line?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          message_body?: string
          name?: string
          recipient_type?: string | null
          subject_line?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      encryption_keys: {
        Row: {
          created_at: string | null
          id: string
          key_value: string
          rotated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_value: string
          rotated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key_value?: string
          rotated_at?: string | null
        }
        Relationships: []
      }
      feature_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          feature_description: string
          feature_title: string
          id: string
          status: string
          updated_at: string
          use_case: string | null
          user_id: string | null
          votes_count: number
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          feature_description: string
          feature_title: string
          id?: string
          status?: string
          updated_at?: string
          use_case?: string | null
          user_id?: string | null
          votes_count?: number
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          feature_description?: string
          feature_title?: string
          id?: string
          status?: string
          updated_at?: string
          use_case?: string | null
          user_id?: string | null
          votes_count?: number
        }
        Relationships: []
      }
      inspection_schedules: {
        Row: {
          advance_notice_days: number
          created_at: string
          due_date: string
          id: string
          inspection_name: string
          inspection_type: string
          is_active: boolean | null
          last_notification_sent: string | null
          notes: string | null
          ride_id: string
          schedule_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          advance_notice_days?: number
          created_at?: string
          due_date: string
          id?: string
          inspection_name: string
          inspection_type: string
          is_active?: boolean | null
          last_notification_sent?: string | null
          notes?: string | null
          ride_id: string
          schedule_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          advance_notice_days?: number
          created_at?: string
          due_date?: string
          id?: string
          inspection_name?: string
          inspection_type?: string
          is_active?: boolean | null
          last_notification_sent?: string | null
          notes?: string | null
          ride_id?: string
          schedule_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inspection_schedules_ride"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
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
          is_test_data: boolean
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
          is_test_data?: boolean
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
          is_test_data?: boolean
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
      marketing_contacts: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          id: string
          is_subscribed: boolean
          name: string | null
          notes: string | null
          tags: string[] | null
          unsubscribe_token: string | null
          unsubscribed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          id?: string
          is_subscribed?: boolean
          name?: string | null
          notes?: string | null
          tags?: string[] | null
          unsubscribe_token?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          id?: string
          is_subscribed?: boolean
          name?: string | null
          notes?: string | null
          tags?: string[] | null
          unsubscribe_token?: string | null
          unsubscribed_at?: string | null
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
          app_mode: string
          billing_cycle: string | null
          company_name: string | null
          controller_name: string | null
          country: string | null
          created_at: string
          current_period_end: string | null
          custom_terminology: Json | null
          enable_document_versioning: boolean
          extra_items_count: number | null
          id: string
          is_suspended: boolean
          operator_type: string | null
          showmen_name: string | null
          stripe_customer_id: string | null
          stripe_customer_id_encrypted: string | null
          stripe_subscription_id: string | null
          stripe_subscription_id_encrypted: string | null
          subscription_plan: string | null
          subscription_status: string | null
          suspended_at: string | null
          suspended_reason: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          app_mode?: string
          billing_cycle?: string | null
          company_name?: string | null
          controller_name?: string | null
          country?: string | null
          created_at?: string
          current_period_end?: string | null
          custom_terminology?: Json | null
          enable_document_versioning?: boolean
          extra_items_count?: number | null
          id?: string
          is_suspended?: boolean
          operator_type?: string | null
          showmen_name?: string | null
          stripe_customer_id?: string | null
          stripe_customer_id_encrypted?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_id_encrypted?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          app_mode?: string
          billing_cycle?: string | null
          company_name?: string | null
          controller_name?: string | null
          country?: string | null
          created_at?: string
          current_period_end?: string | null
          custom_terminology?: Json | null
          enable_document_versioning?: boolean
          extra_items_count?: number | null
          id?: string
          is_suspended?: boolean
          operator_type?: string | null
          showmen_name?: string | null
          stripe_customer_id?: string | null
          stripe_customer_id_encrypted?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_id_encrypted?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_entries: {
        Row: {
          count: number
          created_at: string
          id: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      ride_categories: {
        Row: {
          category_group: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category_group?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category_group?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      ride_type_requests: {
        Row: {
          additional_info: string | null
          admin_notes: string | null
          created_at: string
          description: string
          id: string
          manufacturer: string | null
          name: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_info?: string | null
          admin_notes?: string | null
          created_at?: string
          description: string
          id?: string
          manufacturer?: string | null
          name: string
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_info?: string | null
          admin_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          manufacturer?: string | null
          name?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_test_data: boolean
          manufacturer: string | null
          owner_name: string | null
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
          is_test_data?: boolean
          manufacturer?: string | null
          owner_name?: string | null
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
          is_test_data?: boolean
          manufacturer?: string | null
          owner_name?: string | null
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
      risk_assessment_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          id: string
          new_values: Json | null
          notes: string | null
          old_values: Json | null
          risk_assessment_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          id?: string
          new_values?: Json | null
          notes?: string | null
          old_values?: Json | null
          risk_assessment_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          id?: string
          new_values?: Json | null
          notes?: string | null
          old_values?: Json | null
          risk_assessment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessment_audit_log_risk_assessment_id_fkey"
            columns: ["risk_assessment_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessment_items: {
        Row: {
          action_owner: string | null
          additional_actions: string | null
          created_at: string
          existing_controls: string | null
          hazard_description: string
          id: string
          last_modified_at: string | null
          last_modified_by: string | null
          likelihood: string
          risk_assessment_id: string
          risk_level: string
          severity: string
          sort_order: number | null
          status: string
          target_date: string | null
          who_at_risk: string
        }
        Insert: {
          action_owner?: string | null
          additional_actions?: string | null
          created_at?: string
          existing_controls?: string | null
          hazard_description: string
          id?: string
          last_modified_at?: string | null
          last_modified_by?: string | null
          likelihood?: string
          risk_assessment_id: string
          risk_level?: string
          severity?: string
          sort_order?: number | null
          status?: string
          target_date?: string | null
          who_at_risk: string
        }
        Update: {
          action_owner?: string | null
          additional_actions?: string | null
          created_at?: string
          existing_controls?: string | null
          hazard_description?: string
          id?: string
          last_modified_at?: string | null
          last_modified_by?: string | null
          likelihood?: string
          risk_assessment_id?: string
          risk_level?: string
          severity?: string
          sort_order?: number | null
          status?: string
          target_date?: string | null
          who_at_risk?: string
        }
        Relationships: []
      }
      risk_assessments: {
        Row: {
          assessment_date: string
          assessor_name: string
          created_at: string
          id: string
          is_test_data: boolean
          last_modified_at: string | null
          last_modified_by: string | null
          notes: string | null
          overall_status: string
          review_date: string | null
          revision_notes: string | null
          revision_number: number
          ride_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_date?: string
          assessor_name: string
          created_at?: string
          id?: string
          is_test_data?: boolean
          last_modified_at?: string | null
          last_modified_by?: string | null
          notes?: string | null
          overall_status?: string
          review_date?: string | null
          revision_notes?: string | null
          revision_number?: number
          ride_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_date?: string
          assessor_name?: string
          created_at?: string
          id?: string
          is_test_data?: boolean
          last_modified_at?: string | null
          last_modified_by?: string | null
          notes?: string | null
          overall_status?: string
          review_date?: string | null
          revision_notes?: string | null
          revision_number?: number
          ride_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_change_audit: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_role: string
          previous_role: string
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_role: string
          previous_role: string
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_role?: string
          previous_role?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_recipients: {
        Row: {
          created_at: string
          email: string
          id: string
          is_favorite: boolean | null
          name: string
          notes: string | null
          organization_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_favorite?: boolean | null
          name: string
          notes?: string | null
          organization_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_favorite?: boolean | null
          name?: string
          notes?: string | null
          organization_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          admin_response: string | null
          created_at: string
          id: string
          message: string
          priority: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tester_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invite_token: string
          invited_by: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tester_sessions: {
        Row: {
          created_at: string
          duration_minutes: number | null
          id: string
          session_end: string | null
          session_start: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          session_end?: string | null
          session_start?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          session_end?: string | null
          session_start?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_safe: {
        Row: {
          address: string | null
          app_mode: string | null
          company_name: string | null
          controller_name: string | null
          country: string | null
          created_at: string | null
          custom_terminology: Json | null
          enable_document_versioning: boolean | null
          has_subscription: boolean | null
          id: string | null
          is_suspended: boolean | null
          is_trial: boolean | null
          operator_type: string | null
          showmen_name: string | null
          suspension_info: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          app_mode?: string | null
          company_name?: string | null
          controller_name?: string | null
          country?: string | null
          created_at?: string | null
          custom_terminology?: Json | null
          enable_document_versioning?: boolean | null
          has_subscription?: never
          id?: string | null
          is_suspended?: boolean | null
          is_trial?: never
          operator_type?: string | null
          showmen_name?: string | null
          suspension_info?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          app_mode?: string | null
          company_name?: string | null
          controller_name?: string | null
          country?: string | null
          created_at?: string | null
          custom_terminology?: Json | null
          enable_document_versioning?: boolean | null
          has_subscription?: never
          id?: string | null
          is_suspended?: boolean | null
          is_trial?: never
          operator_type?: string | null
          showmen_name?: string | null
          suspension_info?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: { p_key: string; p_max_requests: number; p_window_ms: number }
        Returns: Json
      }
      cleanup_expired_blocks: { Args: never; Returns: number }
      cleanup_old_blocked_ips: { Args: never; Returns: number }
      decrypt_sensitive: { Args: { ciphertext: string }; Returns: string }
      encrypt_sensitive: { Args: { plaintext: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
      is_ip_blocked: {
        Args: { p_ip: string }
        Returns: {
          expires_at: string
          is_blocked: boolean
          reason: string
        }[]
      }
      is_tester: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "tester"
      check_frequency: "daily" | "monthly" | "yearly" | "preopening"
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
    Enums: {
      app_role: ["admin", "user", "tester"],
      check_frequency: ["daily", "monthly", "yearly", "preopening"],
    },
  },
} as const
