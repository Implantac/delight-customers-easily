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
  public: {
    Tables: {
      activities: {
        Row: {
          completed: boolean
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          title: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          amount: number | null
          approver_id: string | null
          created_at: string
          currency: string | null
          decided_at: string | null
          decision_note: string | null
          description: string | null
          id: string
          organization_id: string
          reference_id: string | null
          reference_type: string | null
          requester_id: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          approver_id?: string | null
          created_at?: string
          currency?: string | null
          decided_at?: string | null
          decision_note?: string | null
          description?: string | null
          id?: string
          organization_id: string
          reference_id?: string | null
          reference_type?: string | null
          requester_id: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          approver_id?: string | null
          created_at?: string
          currency?: string | null
          decided_at?: string | null
          decision_note?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          reference_id?: string | null
          reference_type?: string | null
          requester_id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          mime_type: string | null
          organization_id: string
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          mime_type?: string | null
          organization_id: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      automations: {
        Row: {
          action_config: Json
          action_type: string
          conditions: Json
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          organization_id: string
          run_count: number
          trigger_event: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          conditions?: Json
          created_at?: string
          created_by: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          organization_id: string
          run_count?: number
          trigger_event: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          conditions?: Json
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          organization_id?: string
          run_count?: number
          trigger_event?: string
          updated_at?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          accelerator_percent: number
          active: boolean
          base_percent: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          quota_bonus: number
          updated_at: string
        }
        Insert: {
          accelerator_percent?: number
          active?: boolean
          base_percent?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          quota_bonus?: number
          updated_at?: string
        }
        Update: {
          accelerator_percent?: number
          active?: boolean
          base_percent?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          quota_bonus?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          custom_values: Json
          id: string
          industry: string | null
          name: string
          notes: string | null
          organization_id: string
          size: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          custom_values?: Json
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          organization_id: string
          size?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          custom_values?: Json
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          size?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          custom_values: Json
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          custom_values?: Json
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          custom_values?: Json
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          position?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_events: {
        Row: {
          contract_id: string
          created_at: string
          created_by: string
          description: string | null
          event_type: string
          id: string
          organization_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          created_by: string
          description?: string | null
          event_type: string
          id?: string
          organization_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_type?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount: number | null
          auto_renew: boolean
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          currency: string
          deal_id: string | null
          description: string | null
          document_url: string | null
          end_date: string | null
          id: string
          notes: string | null
          number: string
          organization_id: string
          owner_id: string | null
          renewal_alert_days: number
          signed_at: string | null
          start_date: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          auto_renew?: boolean
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          number: string
          organization_id: string
          owner_id?: string | null
          renewal_alert_days?: number
          signed_at?: string | null
          start_date?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          auto_renew?: boolean
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          number?: string
          organization_id?: string
          owner_id?: string | null
          renewal_alert_days?: number
          signed_at?: string | null
          start_date?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kind: string
          last_message_at: string
          organization_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          last_message_at?: string
          organization_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          last_message_at?: string
          organization_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_defs: {
        Row: {
          created_at: string
          entity: Database["public"]["Enums"]["custom_field_entity"]
          id: string
          key: string
          kind: Database["public"]["Enums"]["custom_field_kind"]
          label: string
          options: Json
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity: Database["public"]["Enums"]["custom_field_entity"]
          id?: string
          key: string
          kind?: Database["public"]["Enums"]["custom_field_kind"]
          label: string
          options?: Json
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: Database["public"]["Enums"]["custom_field_entity"]
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["custom_field_kind"]
          label?: string
          options?: Json
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      deal_events: {
        Row: {
          created_at: string
          deal_id: string
          event_type: string
          from_value: Json | null
          id: string
          organization_id: string
          to_value: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          event_type: string
          from_value?: Json | null
          id?: string
          organization_id: string
          to_value?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          event_type?: string
          from_value?: Json | null
          id?: string
          organization_id?: string
          to_value?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          closed_at: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          custom_values: Json
          expected_close: string | null
          id: string
          notes: string | null
          organization_id: string
          outcome_notes: string | null
          outcome_reason: string | null
          position: number
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          closed_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          custom_values?: Json
          expected_close?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          outcome_notes?: string | null
          outcome_reason?: string | null
          position?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          closed_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          custom_values?: Json
          expected_close?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          outcome_notes?: string | null
          outcome_reason?: string | null
          position?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_recipients: {
        Row: {
          bounced_at: string | null
          campaign_id: string
          clicked_at: string | null
          contact_id: string | null
          created_at: string
          email: string
          error: string | null
          id: string
          name: string | null
          opened_at: string | null
          organization_id: string
          sent_at: string | null
          status: string
          unsubscribed_at: string | null
        }
        Insert: {
          bounced_at?: string | null
          campaign_id: string
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string
          email: string
          error?: string | null
          id?: string
          name?: string | null
          opened_at?: string | null
          organization_id: string
          sent_at?: string | null
          status?: string
          unsubscribed_at?: string | null
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          name?: string | null
          opened_at?: string | null
          organization_id?: string
          sent_at?: string | null
          status?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          created_by: string | null
          from_email: string
          from_name: string
          id: string
          name: string
          organization_id: string
          preheader: string | null
          reply_to: string | null
          scheduled_at: string | null
          segment_id: string | null
          sent_at: string | null
          status: string
          subject: string
          tags: string[]
          total_bounced: number
          total_clicked: number
          total_delivered: number
          total_opened: number
          total_recipients: number
          total_sent: number
          total_unsubscribed: number
          updated_at: string
        }
        Insert: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          from_email: string
          from_name?: string
          id?: string
          name: string
          organization_id: string
          preheader?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          tags?: string[]
          total_bounced?: number
          total_clicked?: number
          total_delivered?: number
          total_opened?: number
          total_recipients?: number
          total_sent?: number
          total_unsubscribed?: number
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          from_email?: string
          from_name?: string
          id?: string
          name?: string
          organization_id?: string
          preheader?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          tags?: string[]
          total_bounced?: number
          total_clicked?: number
          total_delivered?: number
          total_opened?: number
          total_recipients?: number
          total_sent?: number
          total_unsubscribed?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          company_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          decided_at: string | null
          decided_by: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          organization_id: string
          payment_method: string | null
          receipt_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          company_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          receipt_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          receipt_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          due_date: string
          id: string
          issued_at: string
          notes: string | null
          number: string | null
          organization_id: string
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_date: string
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string | null
          organization_id: string
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_date?: string
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string | null
          organization_id?: string
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kb_articles: {
        Row: {
          author_id: string
          category: string | null
          content: string
          created_at: string
          id: string
          organization_id: string
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id: string
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          organization_id: string
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      lead_form_submissions: {
        Row: {
          contact_id: string | null
          created_at: string
          deal_id: string | null
          email: string | null
          form_id: string
          id: string
          ip_address: string | null
          name: string | null
          organization_id: string
          payload: Json
          phone: string | null
          source_url: string | null
          user_agent: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          email?: string | null
          form_id: string
          id?: string
          ip_address?: string | null
          name?: string | null
          organization_id: string
          payload: Json
          phone?: string | null
          source_url?: string | null
          user_agent?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          email?: string | null
          form_id?: string
          id?: string
          ip_address?: string | null
          name?: string | null
          organization_id?: string
          payload?: Json
          phone?: string | null
          source_url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "lead_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_forms: {
        Row: {
          active: boolean
          create_contact: boolean
          create_deal: boolean
          created_at: string
          created_by: string
          default_owner_id: string | null
          default_source: string | null
          description: string | null
          fields: Json
          id: string
          name: string
          notify_emails: string[] | null
          organization_id: string
          redirect_url: string | null
          slug: string
          submissions_count: number
          success_message: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          create_contact?: boolean
          create_deal?: boolean
          created_at?: string
          created_by?: string
          default_owner_id?: string | null
          default_source?: string | null
          description?: string | null
          fields?: Json
          id?: string
          name: string
          notify_emails?: string[] | null
          organization_id: string
          redirect_url?: string | null
          slug: string
          submissions_count?: number
          success_message?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          create_contact?: boolean
          create_deal?: boolean
          created_at?: string
          created_by?: string
          default_owner_id?: string | null
          default_source?: string | null
          description?: string | null
          fields?: Json
          id?: string
          name?: string
          notify_emails?: string[] | null
          organization_id?: string
          redirect_url?: string | null
          slug?: string
          submissions_count?: number
          success_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_routing_assignees: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          position: number
          rule_id: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          position?: number
          rule_id: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          position?: number
          rule_id?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_routing_assignees_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "lead_routing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_routing_log: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          lead_id: string
          lead_type: string
          organization_id: string
          reason: string | null
          rule_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          lead_id: string
          lead_type: string
          organization_id: string
          reason?: string | null
          rule_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          lead_type?: string
          organization_id?: string
          reason?: string | null
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_routing_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "lead_routing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_routing_rules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          match_max_value: number | null
          match_min_value: number | null
          match_source: string | null
          match_tags: string[] | null
          match_territory_id: string | null
          name: string
          organization_id: string
          priority: number
          rr_cursor: number
          strategy: Database["public"]["Enums"]["routing_strategy"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          match_max_value?: number | null
          match_min_value?: number | null
          match_source?: string | null
          match_tags?: string[] | null
          match_territory_id?: string | null
          name: string
          organization_id: string
          priority?: number
          rr_cursor?: number
          strategy?: Database["public"]["Enums"]["routing_strategy"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          match_max_value?: number | null
          match_min_value?: number | null
          match_source?: string | null
          match_tags?: string[] | null
          match_territory_id?: string | null
          name?: string
          organization_id?: string
          priority?: number
          rr_cursor?: number
          strategy?: Database["public"]["Enums"]["routing_strategy"]
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string | null
          channel: string
          created_at: string
          created_by: string | null
          id: string
          is_shared: boolean
          name: string
          organization_id: string
          subject: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          body: string
          category?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_shared?: boolean
          name: string
          organization_id: string
          subject?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          body?: string
          category?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          organization_id?: string
          subject?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_url: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          organization_id: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          organization_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_projects: {
        Row: {
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          health: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          owner_id: string | null
          progress_pct: number
          started_at: string | null
          status: string
          steps: Json
          template_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          health?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          progress_pct?: number
          started_at?: string | null
          status?: string
          steps?: Json
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          health?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          progress_pct?: number
          started_at?: string | null
          status?: string
          steps?: Json
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_projects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          id: string
          occurred_at: string
          organization_id: string
          product_id: string | null
          quantity: number
          unit_cost: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          occurred_at?: string
          organization_id: string
          product_id?: string | null
          quantity?: number
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          occurred_at?: string
          organization_id?: string
          product_id?: string | null
          quantity?: number
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      playbook_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          organization_id: string
          playbook_id: string
          position: number
          required: boolean
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          playbook_id: string
          position?: number
          required?: boolean
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          playbook_id?: string
          position?: number
          required?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_items_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_run_items: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          id: string
          item_id: string
          note: string | null
          organization_id: string
          run_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          item_id: string
          note?: string | null
          organization_id: string
          run_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          item_id?: string
          note?: string | null
          organization_id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_run_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "playbook_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "playbook_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_runs: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          deal_id: string | null
          id: string
          organization_id: string
          playbook_id: string
          started_at: string
          started_by: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          deal_id?: string | null
          id?: string
          organization_id: string
          playbook_id: string
          started_at?: string
          started_by: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          deal_id?: string | null
          id?: string
          organization_id?: string
          playbook_id?: string
          started_at?: string
          started_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_runs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_runs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_runs_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          stage: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          stage?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          stage?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          sku: string | null
          stock_qty: number
          unit_cost: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          sku?: string | null
          stock_qty?: number
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          sku?: string | null
          stock_qty?: number
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_organization_id: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_organization_id?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_organization_id?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          description: string
          discount_percent: number
          id: string
          organization_id: string
          product_id: string | null
          proposal_id: string
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount_percent?: number
          id?: string
          organization_id: string
          product_id?: string | null
          proposal_id: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          organization_id?: string
          product_id?: string | null
          proposal_id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          discount_percent: number
          id: string
          notes: string | null
          organization_id: string
          share_token: string
          status: string
          subtotal: number
          title: string
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          discount_percent?: number
          id?: string
          notes?: string | null
          organization_id: string
          share_token?: string
          status?: string
          subtotal?: number
          title: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          discount_percent?: number
          id?: string
          notes?: string | null
          organization_id?: string
          share_token?: string
          status?: string
          subtotal?: number
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      referral_programs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          name: string
          organization_id: string
          reward_currency: string
          reward_type: string
          reward_value: number
          starts_at: string | null
          status: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          organization_id: string
          reward_currency?: string
          reward_type?: string
          reward_value?: number
          starts_at?: string | null
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          reward_currency?: string
          reward_type?: string
          reward_value?: number
          starts_at?: string | null
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          deal_value: number | null
          id: string
          notes: string | null
          organization_id: string
          program_id: string | null
          qualified_at: string | null
          referred_company: string | null
          referred_email: string | null
          referred_name: string
          referred_phone: string | null
          referrer_contact_id: string | null
          referrer_email: string | null
          referrer_name: string | null
          referrer_user_id: string | null
          rejected_reason: string | null
          reward_amount: number | null
          reward_paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          deal_value?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          program_id?: string | null
          qualified_at?: string | null
          referred_company?: string | null
          referred_email?: string | null
          referred_name: string
          referred_phone?: string | null
          referrer_contact_id?: string | null
          referrer_email?: string | null
          referrer_name?: string | null
          referrer_user_id?: string | null
          rejected_reason?: string | null
          reward_amount?: number | null
          reward_paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          deal_value?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          program_id?: string | null
          qualified_at?: string | null
          referred_company?: string | null
          referred_email?: string | null
          referred_name?: string
          referred_phone?: string | null
          referrer_contact_id?: string | null
          referrer_email?: string | null
          referrer_name?: string | null
          referrer_user_id?: string | null
          rejected_reason?: string | null
          reward_amount?: number | null
          reward_paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "referral_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          period_month: string
          target_value: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          period_month: string
          target_value: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          period_month?: string
          target_value?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          created_at: string
          entity: string
          filters: Json
          id: string
          is_shared: boolean
          name: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          filters?: Json
          id?: string
          is_shared?: boolean
          name: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity?: string
          filters?: Json
          id?: string
          is_shared?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sequence_enrollments: {
        Row: {
          completed_at: string | null
          contact_id: string
          enrolled_at: string
          enrolled_by: string
          id: string
          organization_id: string
          sequence_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          enrolled_at?: string
          enrolled_by: string
          id?: string
          organization_id: string
          sequence_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          enrolled_at?: string
          enrolled_by?: string
          id?: string
          organization_id?: string
          sequence_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          body: string | null
          created_at: string
          day_offset: number
          id: string
          organization_id: string
          sequence_id: string
          step_order: number
          subject: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          day_offset?: number
          id?: string
          organization_id: string
          sequence_id: string
          step_order: number
          subject: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          day_offset?: number
          id?: string
          organization_id?: string
          sequence_id?: string
          step_order?: number
          subject?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      signature_requests: {
        Row: {
          company_id: string | null
          completed_at: string | null
          contract_id: string | null
          created_at: string
          created_by: string
          deal_id: string | null
          description: string | null
          document_url: string | null
          expires_at: string | null
          id: string
          organization_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["signature_status"]
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          document_url?: string | null
          expires_at?: string | null
          id?: string
          organization_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["signature_status"]
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          document_url?: string | null
          expires_at?: string | null
          id?: string
          organization_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["signature_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      signature_signers: {
        Row: {
          created_at: string
          declined_reason: string | null
          email: string
          id: string
          name: string
          organization_id: string
          position: number
          request_id: string
          role: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["signer_status"]
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          declined_reason?: string | null
          email: string
          id?: string
          name: string
          organization_id: string
          position?: number
          request_id: string
          role?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["signer_status"]
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          declined_reason?: string | null
          email?: string
          id?: string
          name?: string
          organization_id?: string
          position?: number
          request_id?: string
          role?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["signer_status"]
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_signers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          mrr: number
          notes: string | null
          organization_id: string
          plan_name: string
          renewal_date: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          mrr?: number
          notes?: string | null
          organization_id: string
          plan_name: string
          renewal_date: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          mrr?: number
          notes?: string | null
          organization_id?: string
          plan_name?: string
          renewal_date?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          comment: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          organization_id: string
          responded_at: string
          respondent_email: string | null
          respondent_name: string | null
          score: number
          source: string | null
          survey_id: string
        }
        Insert: {
          comment?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          organization_id: string
          responded_at?: string
          respondent_email?: string | null
          respondent_name?: string | null
          score: number
          source?: string | null
          survey_id: string
        }
        Update: {
          comment?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          organization_id?: string
          responded_at?: string
          respondent_email?: string | null
          respondent_name?: string | null
          score?: number
          source?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          question: string
          scale_max: number
          scale_min: number
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          question?: string
          scale_max?: number
          scale_min?: number
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          question?: string
          scale_max?: number
          scale_min?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      taggings: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taggings_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      territories: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          default_owner_id: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          default_owner_id?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          default_owner_id?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      territory_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          territory_id: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          territory_id: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          territory_id?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "territory_members_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_rules: {
        Row: {
          created_at: string
          field: string
          id: string
          operator: string
          organization_id: string
          priority: number
          territory_id: string
          value: string
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          operator?: string
          organization_id: string
          priority?: number
          territory_id: string
          value: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          operator?: string
          organization_id?: string
          priority?: number
          territory_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_rules_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          organization_id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          channel: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          organization_id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          channel?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          organization_id: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          channel?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          organization_id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string
          enabled: boolean
          events: string[]
          id: string
          name: string
          organization_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          enabled?: boolean
          events?: string[]
          id?: string
          name: string
          organization_id: string
          secret?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          enabled?: boolean
          events?: string[]
          id?: string
          name?: string
          organization_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_org_invite: { Args: { _token: string }; Returns: string }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "task" | "note"
      custom_field_entity: "contact" | "company" | "deal"
      custom_field_kind: "text" | "number" | "date" | "select" | "boolean"
      deal_stage:
        | "lead"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      org_role: "owner" | "admin" | "member"
      routing_strategy:
        | "round_robin"
        | "weighted"
        | "first_available"
        | "manual"
      signature_status:
        | "draft"
        | "sent"
        | "viewed"
        | "signed"
        | "declined"
        | "expired"
        | "cancelled"
      signer_status: "pending" | "viewed" | "signed" | "declined"
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
      activity_type: ["call", "email", "meeting", "task", "note"],
      custom_field_entity: ["contact", "company", "deal"],
      custom_field_kind: ["text", "number", "date", "select", "boolean"],
      deal_stage: [
        "lead",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      org_role: ["owner", "admin", "member"],
      routing_strategy: [
        "round_robin",
        "weighted",
        "first_available",
        "manual",
      ],
      signature_status: [
        "draft",
        "sent",
        "viewed",
        "signed",
        "declined",
        "expired",
        "cancelled",
      ],
      signer_status: ["pending", "viewed", "signed", "declined"],
    },
  },
} as const
