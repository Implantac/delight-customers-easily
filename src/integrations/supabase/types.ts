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
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
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
      ai_churn_predictions: {
        Row: {
          churn_probability: number
          computed_at: string
          created_at: string
          drivers: Json
          erp_customer_id: string
          expires_at: string
          id: string
          model: string | null
          organization_id: string
          risk_level: string
          suggested_actions: Json
          updated_at: string
        }
        Insert: {
          churn_probability: number
          computed_at?: string
          created_at?: string
          drivers?: Json
          erp_customer_id: string
          expires_at?: string
          id?: string
          model?: string | null
          organization_id: string
          risk_level: string
          suggested_actions?: Json
          updated_at?: string
        }
        Update: {
          churn_probability?: number
          computed_at?: string
          created_at?: string
          drivers?: Json
          erp_customer_id?: string
          expires_at?: string
          id?: string
          model?: string | null
          organization_id?: string
          risk_level?: string
          suggested_actions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_churn_predictions_erp_customer_id_fkey"
            columns: ["erp_customer_id"]
            isOneToOne: false
            referencedRelation: "erp_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_churn_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "ai_churn_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "ai_churn_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "ai_churn_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "ai_churn_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "ai_churn_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_lead_scores: {
        Row: {
          computed_at: string
          created_at: string
          expires_at: string
          id: string
          model: string | null
          organization_id: string
          reasons: Json
          score: number
          subject_id: string
          subject_type: string
          tier: string | null
          updated_at: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          model?: string | null
          organization_id: string
          reasons?: Json
          score: number
          subject_id: string
          subject_type: string
          tier?: string | null
          updated_at?: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          model?: string | null
          organization_id?: string
          reasons?: Json
          score?: number
          subject_id?: string
          subject_type?: string
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_lead_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "ai_lead_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "ai_lead_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "ai_lead_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "ai_lead_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "ai_lead_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          body: string | null
          computed_at: string
          created_at: string
          expires_at: string
          id: string
          model: string | null
          organization_id: string
          payload: Json
          priority: number
          recommendation_type: string
          status: string
          subject_id: string
          subject_type: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          computed_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          model?: string | null
          organization_id: string
          payload?: Json
          priority?: number
          recommendation_type: string
          status?: string
          subject_id: string
          subject_type: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          computed_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          model?: string | null
          organization_id?: string
          payload?: Json
          priority?: number
          recommendation_type?: string
          status?: string
          subject_id?: string
          subject_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "ai_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "ai_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "ai_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "ai_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "ai_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_repurchase_predictions: {
        Row: {
          computed_at: string
          confidence: number | null
          created_at: string
          erp_customer_id: string
          expected_purchase_at: string | null
          expected_value: number | null
          expires_at: string
          id: string
          model: string | null
          organization_id: string
          reasons: Json
          suggested_skus: Json
          updated_at: string
        }
        Insert: {
          computed_at?: string
          confidence?: number | null
          created_at?: string
          erp_customer_id: string
          expected_purchase_at?: string | null
          expected_value?: number | null
          expires_at?: string
          id?: string
          model?: string | null
          organization_id: string
          reasons?: Json
          suggested_skus?: Json
          updated_at?: string
        }
        Update: {
          computed_at?: string
          confidence?: number | null
          created_at?: string
          erp_customer_id?: string
          expected_purchase_at?: string | null
          expected_value?: number | null
          expires_at?: string
          id?: string
          model?: string | null
          organization_id?: string
          reasons?: Json
          suggested_skus?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_repurchase_predictions_erp_customer_id_fkey"
            columns: ["erp_customer_id"]
            isOneToOne: false
            referencedRelation: "erp_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_repurchase_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "ai_repurchase_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "ai_repurchase_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "ai_repurchase_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "ai_repurchase_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "ai_repurchase_predictions_organization_id_fkey"
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
      asset_assignments: {
        Row: {
          asset_id: string
          assigned_at: string
          assigned_by: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          returned_at: string | null
        }
        Insert: {
          asset_id: string
          assigned_at?: string
          assigned_by?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          returned_at?: string | null
        }
        Update: {
          asset_id?: string
          assigned_at?: string
          assigned_by?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          assigned_at: string | null
          category: string | null
          cost: number | null
          created_at: string
          current_company_id: string | null
          current_contact_id: string | null
          id: string
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string
          purchased_at: string | null
          serial_number: string | null
          status: string
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          assigned_at?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          current_company_id?: string | null
          current_contact_id?: string | null
          id?: string
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id: string
          purchased_at?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          assigned_at?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          current_company_id?: string | null
          current_contact_id?: string | null
          id?: string
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          purchased_at?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          warranty_until?: string | null
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
      bank_accounts: {
        Row: {
          account_number: string | null
          bank_name: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          counterparty: string | null
          created_at: string
          description: string
          expense_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          occurred_at: string
          organization_id: string
          reconciled: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category?: string | null
          counterparty?: string | null
          created_at?: string
          description: string
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          occurred_at: string
          organization_id: string
          reconciled?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          counterparty?: string | null
          created_at?: string
          description?: string
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          reconciled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_health_scores: {
        Row: {
          computed_at: string
          id: string
          organization_id: string
          pillars: Json
          score: number
        }
        Insert: {
          computed_at?: string
          id?: string
          organization_id: string
          pillars?: Json
          score: number
        }
        Update: {
          computed_at?: string
          id?: string
          organization_id?: string
          pillars?: Json
          score?: number
        }
        Relationships: []
      }
      commission_payouts: {
        Row: {
          accelerator: number
          base_commission: number
          bonus: number
          created_at: string
          created_by: string | null
          deals_count: number
          goal_value: number
          id: string
          locked_at: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          period_month: string
          rule_id: string | null
          sold_value: number
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accelerator?: number
          base_commission?: number
          bonus?: number
          created_at?: string
          created_by?: string | null
          deals_count?: number
          goal_value?: number
          id?: string
          locked_at?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          period_month: string
          rule_id?: string | null
          sold_value?: number
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accelerator?: number
          base_commission?: number
          bonus?: number
          created_at?: string
          created_by?: string | null
          deals_count?: number
          goal_value?: number
          id?: string
          locked_at?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          period_month?: string
          rule_id?: string | null
          sold_value?: number
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "commission_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "commission_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "commission_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "commission_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "commission_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payouts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "commission_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "commission_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "commission_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "commission_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
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
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          custom_values: Json
          id: string
          industry: string | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          omie_id: number | null
          omie_synced_at: string | null
          organization_id: string
          size: string | null
          state: string | null
          updated_at: string
          user_id: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          custom_values?: Json
          id?: string
          industry?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          omie_id?: number | null
          omie_synced_at?: string | null
          organization_id: string
          size?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          custom_values?: Json
          id?: string
          industry?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          omie_id?: number | null
          omie_synced_at?: string | null
          organization_id?: string
          size?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
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
          omie_id: number | null
          omie_synced_at: string | null
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
          omie_id?: number | null
          omie_synced_at?: string | null
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
          omie_id?: number | null
          omie_synced_at?: string | null
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
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
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
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "conversation_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "conversation_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "conversation_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "conversation_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
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
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
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
      customer_360_snapshot: {
        Row: {
          activities_30d: number
          cnpj: string | null
          company_id: string | null
          computed_at: string
          created_at: string
          display_name: string | null
          erp_customer_id: string | null
          frequency: number | null
          has_email: boolean
          has_whatsapp: boolean
          id: string
          last_activity_at: string | null
          last_purchase_at: string | null
          monetary: number | null
          open_deals_count: number
          open_deals_value: number
          organization_id: string
          primary_email: string | null
          primary_phone: string | null
          recency_days: number | null
          rfm_segment: string | null
          trend: string | null
          updated_at: string
          won_deals_count_365d: number
          won_deals_value_365d: number
        }
        Insert: {
          activities_30d?: number
          cnpj?: string | null
          company_id?: string | null
          computed_at?: string
          created_at?: string
          display_name?: string | null
          erp_customer_id?: string | null
          frequency?: number | null
          has_email?: boolean
          has_whatsapp?: boolean
          id?: string
          last_activity_at?: string | null
          last_purchase_at?: string | null
          monetary?: number | null
          open_deals_count?: number
          open_deals_value?: number
          organization_id: string
          primary_email?: string | null
          primary_phone?: string | null
          recency_days?: number | null
          rfm_segment?: string | null
          trend?: string | null
          updated_at?: string
          won_deals_count_365d?: number
          won_deals_value_365d?: number
        }
        Update: {
          activities_30d?: number
          cnpj?: string | null
          company_id?: string | null
          computed_at?: string
          created_at?: string
          display_name?: string | null
          erp_customer_id?: string | null
          frequency?: number | null
          has_email?: boolean
          has_whatsapp?: boolean
          id?: string
          last_activity_at?: string | null
          last_purchase_at?: string | null
          monetary?: number | null
          open_deals_count?: number
          open_deals_value?: number
          organization_id?: string
          primary_email?: string | null
          primary_phone?: string | null
          recency_days?: number | null
          rfm_segment?: string | null
          trend?: string | null
          updated_at?: string
          won_deals_count_365d?: number
          won_deals_value_365d?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_360_snapshot_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_360_snapshot_erp_customer_id_fkey"
            columns: ["erp_customer_id"]
            isOneToOne: false
            referencedRelation: "erp_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_360_snapshot_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "customer_360_snapshot_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "customer_360_snapshot_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "customer_360_snapshot_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "customer_360_snapshot_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "customer_360_snapshot_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
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
      document_folders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          document_id: string
          id: string
          notes: string | null
          organization_id: string
          size_bytes: number | null
          uploaded_by: string | null
          url: string
          version: number
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          notes?: string | null
          organization_id: string
          size_bytes?: number | null
          uploaded_by?: string | null
          url: string
          version: number
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          size_bytes?: number | null
          uploaded_by?: string | null
          url?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          folder_id: string | null
          id: string
          mime_type: string | null
          name: string
          organization_id: string
          size_bytes: number | null
          tags: string[]
          updated_at: string
          uploaded_by: string | null
          url: string
          version: number
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          organization_id: string
          size_bytes?: number | null
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
          url: string
          version?: number
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          organization_id?: string
          size_bytes?: number | null
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
          url?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
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
      erp_agent_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          organization_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_agent_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_agent_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_agent_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_agent_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_agent_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_agent_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_customer_metrics: {
        Row: {
          avg_ticket: number | null
          computed_at: string
          erp_customer_id: string
          frequency_365d: number
          frequency_90d: number
          id: string
          last_order_at: string | null
          monetary_365d: number
          monetary_90d: number
          organization_id: string
          recency_days: number | null
          rfm_segment: string | null
          trend_90d: number | null
        }
        Insert: {
          avg_ticket?: number | null
          computed_at?: string
          erp_customer_id: string
          frequency_365d?: number
          frequency_90d?: number
          id?: string
          last_order_at?: string | null
          monetary_365d?: number
          monetary_90d?: number
          organization_id: string
          recency_days?: number | null
          rfm_segment?: string | null
          trend_90d?: number | null
        }
        Update: {
          avg_ticket?: number | null
          computed_at?: string
          erp_customer_id?: string
          frequency_365d?: number
          frequency_90d?: number
          id?: string
          last_order_at?: string | null
          monetary_365d?: number
          monetary_90d?: number
          organization_id?: string
          recency_days?: number | null
          rfm_segment?: string | null
          trend_90d?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_customer_metrics_erp_customer_id_fkey"
            columns: ["erp_customer_id"]
            isOneToOne: false
            referencedRelation: "erp_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_customer_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_customer_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_customer_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_customer_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_customer_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_customer_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_customers: {
        Row: {
          city: string | null
          commercial_status: string | null
          company_id: string | null
          created_at: string
          credit_limit: number | null
          credit_status: string | null
          document: string | null
          email: string | null
          external_id: string
          first_purchase_at: string | null
          id: string
          integration_id: string | null
          last_purchase_at: string | null
          legal_name: string | null
          organization_id: string
          phone: string | null
          raw: Json
          sales_rep_external_id: string | null
          segment: string | null
          state: string | null
          synced_at: string
          trade_name: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          city?: string | null
          commercial_status?: string | null
          company_id?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_status?: string | null
          document?: string | null
          email?: string | null
          external_id: string
          first_purchase_at?: string | null
          id?: string
          integration_id?: string | null
          last_purchase_at?: string | null
          legal_name?: string | null
          organization_id: string
          phone?: string | null
          raw?: Json
          sales_rep_external_id?: string | null
          segment?: string | null
          state?: string | null
          synced_at?: string
          trade_name?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          city?: string | null
          commercial_status?: string | null
          company_id?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_status?: string | null
          document?: string | null
          email?: string | null
          external_id?: string
          first_purchase_at?: string | null
          id?: string
          integration_id?: string | null
          last_purchase_at?: string | null
          legal_name?: string | null
          organization_id?: string
          phone?: string | null
          raw?: Json
          sales_rep_external_id?: string | null
          segment?: string | null
          state?: string | null
          synced_at?: string
          trade_name?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_customers_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "erp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_field_mappings: {
        Row: {
          created_at: string
          entity: string
          id: string
          organization_id: string
          provider: string
          source_field: string
          target_field: string
          transform: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity: string
          id?: string
          organization_id: string
          provider: string
          source_field: string
          target_field: string
          transform?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: string
          id?: string
          organization_id?: string
          provider?: string
          source_field?: string
          target_field?: string
          transform?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_field_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_field_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_field_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_field_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_field_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_field_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_health_checks: {
        Row: {
          checked_at: string
          details: Json
          error_message: string | null
          id: string
          integration_id: string
          latency_ms: number | null
          organization_id: string
          status: string
        }
        Insert: {
          checked_at?: string
          details?: Json
          error_message?: string | null
          id?: string
          integration_id: string
          latency_ms?: number | null
          organization_id: string
          status: string
        }
        Update: {
          checked_at?: string
          details?: Json
          error_message?: string | null
          id?: string
          integration_id?: string
          latency_ms?: number | null
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_health_checks_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "erp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_health_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_health_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_health_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_health_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_health_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_health_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_inbound_log: {
        Row: {
          created_at: string
          entity: string
          error: string | null
          external_id: string | null
          id: string
          organization_id: string
          payload: Json
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          entity: string
          error?: string | null
          external_id?: string | null
          id?: string
          organization_id: string
          payload: Json
          provider: string
          status?: string
        }
        Update: {
          created_at?: string
          entity?: string
          error?: string | null
          external_id?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_inbound_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_inbound_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_inbound_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_inbound_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_inbound_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_inbound_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_integrations: {
        Row: {
          app_key: string
          app_secret: string
          connector_type: string
          created_at: string
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          organization_id: string
          provider: string
          resources: string[]
          settings: Json
          sync_cron: string | null
          sync_mode: string
          updated_at: string
        }
        Insert: {
          app_key: string
          app_secret: string
          connector_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          organization_id: string
          provider: string
          resources?: string[]
          settings?: Json
          sync_cron?: string | null
          sync_mode?: string
          updated_at?: string
        }
        Update: {
          app_key?: string
          app_secret?: string
          connector_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          organization_id?: string
          provider?: string
          resources?: string[]
          settings?: Json
          sync_cron?: string | null
          sync_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_product_catalog_lite: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          external_id: string
          id: string
          integration_id: string | null
          is_active: boolean
          name: string
          organization_id: string
          sku: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          external_id: string
          id?: string
          integration_id?: string | null
          is_active?: boolean
          name: string
          organization_id: string
          sku?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          external_id?: string
          id?: string
          integration_id?: string | null
          is_active?: boolean
          name?: string
          organization_id?: string
          sku?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_product_catalog_lite_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "erp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_product_catalog_lite_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_product_catalog_lite_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_product_catalog_lite_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_product_catalog_lite_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_product_catalog_lite_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_product_catalog_lite_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sales_history: {
        Row: {
          channel: string | null
          created_at: string
          customer_external_id: string | null
          erp_customer_id: string | null
          external_id: string
          id: string
          integration_id: string | null
          item_count: number | null
          order_date: string
          organization_id: string
          raw: Json
          sales_rep_external_id: string | null
          status: string | null
          synced_at: string
          total_value: number
        }
        Insert: {
          channel?: string | null
          created_at?: string
          customer_external_id?: string | null
          erp_customer_id?: string | null
          external_id: string
          id?: string
          integration_id?: string | null
          item_count?: number | null
          order_date: string
          organization_id: string
          raw?: Json
          sales_rep_external_id?: string | null
          status?: string | null
          synced_at?: string
          total_value?: number
        }
        Update: {
          channel?: string | null
          created_at?: string
          customer_external_id?: string | null
          erp_customer_id?: string | null
          external_id?: string
          id?: string
          integration_id?: string | null
          item_count?: number | null
          order_date?: string
          organization_id?: string
          raw?: Json
          sales_rep_external_id?: string | null
          status?: string | null
          synced_at?: string
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "erp_sales_history_erp_customer_id_fkey"
            columns: ["erp_customer_id"]
            isOneToOne: false
            referencedRelation: "erp_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_sales_history_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "erp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_sales_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_sales_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_sales_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_sales_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_sales_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_sales_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sales_reps: {
        Row: {
          commission_rate: number | null
          created_at: string
          email: string | null
          external_id: string
          id: string
          integration_id: string | null
          is_active: boolean
          name: string
          organization_id: string
          phone: string | null
          raw: Json
          region: string | null
          synced_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          external_id: string
          id?: string
          integration_id?: string | null
          is_active?: boolean
          name: string
          organization_id: string
          phone?: string | null
          raw?: Json
          region?: string | null
          synced_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          external_id?: string
          id?: string
          integration_id?: string | null
          is_active?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          raw?: Json
          region?: string | null
          synced_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_sales_reps_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "erp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_sales_reps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_sales_reps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_sales_reps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_sales_reps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_sales_reps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_sales_reps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sync_conflicts: {
        Row: {
          crm_value: Json | null
          detected_at: string
          erp_value: Json | null
          external_id: string
          field: string | null
          id: string
          integration_id: string
          notes: string | null
          organization_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          resource: string
        }
        Insert: {
          crm_value?: Json | null
          detected_at?: string
          erp_value?: Json | null
          external_id: string
          field?: string | null
          id?: string
          integration_id: string
          notes?: string | null
          organization_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resource: string
        }
        Update: {
          crm_value?: Json | null
          detected_at?: string
          erp_value?: Json | null
          external_id?: string
          field?: string | null
          id?: string
          integration_id?: string
          notes?: string | null
          organization_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resource?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_sync_conflicts_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "erp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_sync_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_sync_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_sync_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_sync_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_sync_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_sync_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sync_jobs: {
        Row: {
          attempts: number
          created_at: string
          cursor: Json | null
          direction: string
          error_message: string | null
          finished_at: string | null
          id: string
          integration_id: string
          max_attempts: number
          organization_id: string
          records_failed: number
          records_processed: number
          resource: string
          scheduled_at: string
          started_at: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          cursor?: Json | null
          direction?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          integration_id: string
          max_attempts?: number
          organization_id: string
          records_failed?: number
          records_processed?: number
          resource: string
          scheduled_at?: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          cursor?: Json | null
          direction?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          integration_id?: string
          max_attempts?: number
          organization_id?: string
          records_failed?: number
          records_processed?: number
          resource?: string
          scheduled_at?: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_sync_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "erp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "erp_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "erp_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "erp_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      geo_locations: {
        Row: {
          accuracy: string | null
          cep: string | null
          city: string | null
          complement: string | null
          country: string | null
          created_at: string
          geocoded_at: string | null
          geohash: string | null
          ibge_code: string | null
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          number: string | null
          organization_id: string
          source: string | null
          state: string | null
          street: string | null
          subject_id: string
          subject_type: string
          updated_at: string
        }
        Insert: {
          accuracy?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          geocoded_at?: string | null
          geohash?: string | null
          ibge_code?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          number?: string | null
          organization_id: string
          source?: string | null
          state?: string | null
          street?: string | null
          subject_id: string
          subject_type: string
          updated_at?: string
        }
        Update: {
          accuracy?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          geocoded_at?: string | null
          geohash?: string | null
          ibge_code?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          number?: string | null
          organization_id?: string
          source?: string | null
          state?: string | null
          street?: string | null
          subject_id?: string
          subject_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "geo_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "geo_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "geo_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "geo_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "geo_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_route_plans: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          owner_user_id: string
          plan_date: string
          start_lat: number | null
          start_lng: number | null
          status: string
          stops: Json
          title: string
          total_distance_km: number | null
          total_duration_min: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          owner_user_id: string
          plan_date: string
          start_lat?: number | null
          start_lng?: number | null
          status?: string
          stops?: Json
          title: string
          total_distance_km?: number | null
          total_duration_min?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          owner_user_id?: string
          plan_date?: string
          start_lat?: number | null
          start_lng?: number | null
          status?: string
          stops?: Json
          title?: string
          total_distance_km?: number | null
          total_duration_min?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_route_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "geo_route_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "geo_route_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "geo_route_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "geo_route_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "geo_route_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_territories: {
        Row: {
          center_lat: number | null
          center_lng: number | null
          cep_ranges: Json | null
          cities: string[] | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          owner_user_id: string | null
          polygon_geojson: Json | null
          radius_km: number | null
          states: string[] | null
          updated_at: string
        }
        Insert: {
          center_lat?: number | null
          center_lng?: number | null
          cep_ranges?: Json | null
          cities?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          owner_user_id?: string | null
          polygon_geojson?: Json | null
          radius_km?: number | null
          states?: string[] | null
          updated_at?: string
        }
        Update: {
          center_lat?: number | null
          center_lng?: number | null
          cep_ranges?: Json | null
          cities?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          owner_user_id?: string | null
          polygon_geojson?: Json | null
          radius_km?: number | null
          states?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_territories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "geo_territories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "geo_territories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "geo_territories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "geo_territories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "geo_territories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_conversions: {
        Row: {
          commission: number
          created_at: string
          id: string
          influencer_id: string
          kind: string
          organization_id: string
          ref_id: string | null
          status: string
          value: number
        }
        Insert: {
          commission?: number
          created_at?: string
          id?: string
          influencer_id: string
          kind: string
          organization_id: string
          ref_id?: string | null
          status?: string
          value?: number
        }
        Update: {
          commission?: number
          created_at?: string
          id?: string
          influencer_id?: string
          kind?: string
          organization_id?: string
          ref_id?: string | null
          status?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "influencer_conversions_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "influencer_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "influencer_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "influencer_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "influencer_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "influencer_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_visits: {
        Row: {
          country: string | null
          created_at: string
          id: string
          influencer_id: string
          organization_id: string
          referer: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_source: string | null
          visitor_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          influencer_id: string
          organization_id: string
          referer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          influencer_id?: string
          organization_id?: string
          referer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_visits_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "influencer_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "influencer_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "influencer_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "influencer_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "influencer_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          bio: string | null
          commission_pct: number | null
          coupon_code: string | null
          created_at: string
          cta_text: string | null
          cta_url: string | null
          handle: string | null
          headline: string | null
          hero_image_url: string | null
          id: string
          is_active: boolean
          lp_enabled: boolean
          name: string
          notes: string | null
          organization_id: string
          platform: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          commission_pct?: number | null
          coupon_code?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          handle?: string | null
          headline?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          lp_enabled?: boolean
          name: string
          notes?: string | null
          organization_id: string
          platform?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          commission_pct?: number | null
          coupon_code?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          handle?: string | null
          headline?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          lp_enabled?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          platform?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "influencers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "influencers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "influencers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "influencers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "influencers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          account_label: string | null
          config: Json
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_error: string | null
          last_sync_at: string | null
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          account_label?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          last_error?: string | null
          last_sync_at?: string | null
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_label?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_sync_at?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_log: {
        Row: {
          connection_id: string
          details: Json
          error: string | null
          finished_at: string | null
          id: string
          items_failed: number
          items_processed: number
          kind: string
          organization_id: string
          started_at: string
          status: string
        }
        Insert: {
          connection_id: string
          details?: Json
          error?: string | null
          finished_at?: string | null
          id?: string
          items_failed?: number
          items_processed?: number
          kind: string
          organization_id: string
          started_at?: string
          status?: string
        }
        Update: {
          connection_id?: string
          details?: Json
          error?: string | null
          finished_at?: string | null
          id?: string
          items_failed?: number
          items_processed?: number
          kind?: string
          organization_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "integration_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "integration_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "integration_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "integration_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "integration_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      loyalty_accounts: {
        Row: {
          balance: number
          contact_id: string
          created_at: string
          id: string
          organization_id: string
          tier: string
          total_earned: number
          total_redeemed: number
          updated_at: string
        }
        Insert: {
          balance?: number
          contact_id: string
          created_at?: string
          id?: string
          organization_id: string
          tier?: string
          total_earned?: number
          total_redeemed?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          contact_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          tier?: string
          total_earned?: number
          total_redeemed?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_rewards: {
        Row: {
          active: boolean
          cost_points: number
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          stock: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost_points?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          stock?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost_points?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          stock?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          account_id: string
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          organization_id: string
          points: number
          reason: string | null
          reference: string | null
          reward_id: string | null
        }
        Insert: {
          account_id: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          organization_id: string
          points?: number
          reason?: string | null
          reference?: string | null
          reward_id?: string | null
        }
        Update: {
          account_id?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          organization_id?: string
          points?: number
          reason?: string | null
          reference?: string | null
          reward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_leads: {
        Row: {
          channel: string
          city: string | null
          converted_contact_id: string | null
          converted_deal_id: string | null
          created_at: string
          email: string | null
          id: string
          message: string | null
          name: string | null
          organization_id: string
          payload: Json
          phone: string | null
          source: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel: string
          city?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          organization_id: string
          payload?: Json
          phone?: string | null
          source?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          city?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          organization_id?: string
          payload?: Json
          phone?: string | null
          source?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_leads_converted_contact_id_fkey"
            columns: ["converted_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_leads_converted_deal_id_fkey"
            columns: ["converted_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "marketing_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "marketing_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "marketing_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "marketing_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "marketing_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
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
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
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
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
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
          cnpj: string | null
          created_at: string
          created_by: string
          external_branch_code: string | null
          external_company_code: string | null
          id: string
          legal_name: string | null
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          parent_org_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by: string
          external_branch_code?: string | null
          external_company_code?: string | null
          id?: string
          legal_name?: string | null
          name: string
          org_type?: Database["public"]["Enums"]["org_type"]
          parent_org_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string
          external_branch_code?: string | null
          external_company_code?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          parent_org_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
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
          theme_preference: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_organization_id?: string | null
          full_name?: string | null
          id: string
          theme_preference?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_organization_id?: string | null
          full_name?: string | null
          id?: string
          theme_preference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
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
          accepted_at: string | null
          accepted_by_email: string | null
          accepted_by_name: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          discount_percent: number
          id: string
          notes: string | null
          organization_id: string
          rejected_at: string | null
          share_token: string
          status: string
          subtotal: number
          title: string
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          discount_percent?: number
          id?: string
          notes?: string | null
          organization_id: string
          rejected_at?: string | null
          share_token?: string
          status?: string
          subtotal?: number
          title: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          discount_percent?: number
          id?: string
          notes?: string | null
          organization_id?: string
          rejected_at?: string | null
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
      quote_items: {
        Row: {
          created_at: string
          description: string
          discount_pct: number
          id: string
          line_total: number
          organization_id: string
          position: number
          product_id: string | null
          quantity: number
          quote_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount_pct?: number
          id?: string
          line_total?: number
          organization_id: string
          position?: number
          product_id?: string | null
          quantity?: number
          quote_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount_pct?: number
          id?: string
          line_total?: number
          organization_id?: string
          position?: number
          product_id?: string | null
          quantity?: number
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          discount: number
          id: string
          issue_date: string
          notes: string | null
          number: number
          organization_id: string
          status: string
          subtotal: number
          tax: number
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
          currency?: string
          deal_id?: string | null
          discount?: number
          id?: string
          issue_date?: string
          notes?: string | null
          number: number
          organization_id: string
          status?: string
          subtotal?: number
          tax?: number
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
          currency?: string
          deal_id?: string | null
          discount?: number
          id?: string
          issue_date?: string
          notes?: string | null
          number?: number
          organization_id?: string
          status?: string
          subtotal?: number
          tax?: number
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          action_href: string | null
          action_label: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          impact_brl: number | null
          organization_id: string
          priority: number
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          surface: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action_href?: string | null
          action_label?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          impact_brl?: number | null
          organization_id: string
          priority?: number
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          surface: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action_href?: string | null
          action_label?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          impact_brl?: number | null
          organization_id?: string
          priority?: number
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          surface?: string
          title?: string
          updated_at?: string
          user_id?: string | null
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
      sales_forecast_snapshots: {
        Row: {
          computed_at: string
          created_at: string
          id: string
          open_deals_count: number
          open_pipeline_value: number
          organization_id: string
          period_end: string
          period_start: string
          scope: string
          user_id: string | null
          weighted_forecast: number
          weights: Json
          won_value_period: number
        }
        Insert: {
          computed_at?: string
          created_at?: string
          id?: string
          open_deals_count?: number
          open_pipeline_value?: number
          organization_id: string
          period_end: string
          period_start: string
          scope?: string
          user_id?: string | null
          weighted_forecast?: number
          weights?: Json
          won_value_period?: number
        }
        Update: {
          computed_at?: string
          created_at?: string
          id?: string
          open_deals_count?: number
          open_pipeline_value?: number
          organization_id?: string
          period_end?: string
          period_start?: string
          scope?: string
          user_id?: string | null
          weighted_forecast?: number
          weights?: Json
          won_value_period?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_forecast_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "sales_forecast_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "sales_forecast_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sales_forecast_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "sales_forecast_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sales_forecast_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          organization_id: string
          period_month: string
          target_deals_count: number
          target_value: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          organization_id: string
          period_month: string
          target_deals_count?: number
          target_value: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          organization_id?: string
          period_month?: string
          target_deals_count?: number
          target_value?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "sales_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "sales_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sales_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "sales_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sales_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          description: string
          discount_pct: number
          id: string
          line_total: number
          order_id: string
          organization_id: string
          position: number
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount_pct?: number
          id?: string
          line_total?: number
          order_id: string
          organization_id: string
          position?: number
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount_pct?: number
          id?: string
          line_total?: number
          order_id?: string
          organization_id?: string
          position?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount: number
          expected_delivery: string | null
          id: string
          notes: string | null
          number: number
          order_date: string
          organization_id: string
          quote_id: string | null
          status: Database["public"]["Enums"]["sales_order_status"]
          subtotal: number
          tax: number
          title: string
          total: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount?: number
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          number: number
          order_date?: string
          organization_id: string
          quote_id?: string | null
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number
          tax?: number
          title: string
          total?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount?: number
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          number?: number
          order_date?: string
          organization_id?: string
          quote_id?: string | null
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number
          tax?: number
          title?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
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
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["stock_movement_kind"]
          occurred_at: string
          organization_id: string
          product_id: string | null
          product_name: string
          quantity: number
          reason: string | null
          reference: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["stock_movement_kind"]
          occurred_at?: string
          organization_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          reason?: string | null
          reference?: string | null
          unit_cost?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["stock_movement_kind"]
          occurred_at?: string
          organization_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          reason?: string | null
          reference?: string | null
          unit_cost?: number
        }
        Relationships: []
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
      suppliers: {
        Row: {
          address: string | null
          category: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          is_active: boolean
          legal_name: string
          notes: string | null
          organization_id: string
          payment_terms: string | null
          phone: string | null
          trade_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name: string
          notes?: string | null
          organization_id: string
          payment_terms?: string | null
          phone?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string
          notes?: string | null
          organization_id?: string
          payment_terms?: string | null
          phone?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
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
      time_entries: {
        Row: {
          amount: number
          billable: boolean
          billed: boolean
          billed_at: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          duration_minutes: number
          entry_date: string
          hourly_rate: number | null
          id: string
          organization_id: string
          tags: string[]
          ticket_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          billable?: boolean
          billed?: boolean
          billed_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          duration_minutes?: number
          entry_date?: string
          hourly_rate?: number | null
          id?: string
          organization_id: string
          tags?: string[]
          ticket_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billable?: boolean
          billed?: boolean
          billed_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          duration_minutes?: number
          entry_date?: string
          hourly_rate?: number | null
          id?: string
          organization_id?: string
          tags?: string[]
          ticket_id?: string | null
          updated_at?: string
          user_id?: string
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
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          first_message_at: string
          first_response_at: string | null
          id: string
          last_customer_message_at: string | null
          last_message_at: string
          organization_id: string
          priority: string
          resolved_at: string | null
          sla_breached: boolean
          sla_due_at: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          contact_name: string
          contact_phone: string
          created_at?: string
          first_message_at?: string
          first_response_at?: string | null
          id?: string
          last_customer_message_at?: string | null
          last_message_at?: string
          organization_id: string
          priority?: string
          resolved_at?: string | null
          sla_breached?: boolean
          sla_due_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          first_message_at?: string
          first_response_at?: string | null
          id?: string
          last_customer_message_at?: string | null
          last_message_at?: string
          organization_id?: string
          priority?: string
          resolved_at?: string | null
          sla_breached?: boolean
          sla_due_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          attachment_url: string | null
          body: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          organization_id: string
          sender_user_id: string | null
          status: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          organization_id: string
          sender_user_id?: string | null
          status?: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          organization_id?: string
          sender_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sla_policies: {
        Row: {
          business_hours_only: boolean
          created_at: string
          first_response_minutes: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          priority: string
          resolution_minutes: number
          updated_at: string
        }
        Insert: {
          business_hours_only?: boolean
          created_at?: string
          first_response_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id: string
          priority?: string
          resolution_minutes?: number
          updated_at?: string
        }
        Update: {
          business_hours_only?: boolean
          created_at?: string
          first_response_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          priority?: string
          resolution_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["branch_org_id"]
          },
          {
            foreignKeyName: "whatsapp_sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "whatsapp_sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_branch"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "whatsapp_sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["company_org_id"]
          },
          {
            foreignKeyName: "whatsapp_sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_sales_consolidated_by_company"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "whatsapp_sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      org_sales_consolidated_by_branch: {
        Row: {
          branch_name: string | null
          branch_org_id: string | null
          company_name: string | null
          company_org_id: string | null
          distinct_customers_90d: number | null
          orders_90d: number | null
          revenue_90d: number | null
          tenant_org_id: string | null
        }
        Relationships: []
      }
      org_sales_consolidated_by_company: {
        Row: {
          company_name: string | null
          company_org_id: string | null
          distinct_customers_90d: number | null
          orders_90d: number | null
          revenue_90d: number | null
          tenant_org_id: string | null
        }
        Relationships: []
      }
      webhooks_safe: {
        Row: {
          created_at: string | null
          created_by: string | null
          enabled: boolean | null
          events: string[] | null
          id: string | null
          name: string | null
          organization_id: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          enabled?: boolean | null
          events?: string[] | null
          id?: string | null
          name?: string | null
          organization_id?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          enabled?: boolean | null
          events?: string[] | null
          id?: string | null
          name?: string | null
          organization_id?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_org_invite: { Args: { _token: string }; Returns: string }
      compute_sales_forecast: {
        Args: {
          _org: string
          _period_end: string
          _period_start: string
          _weights?: Json
        }
        Returns: string
      }
      find_opportunities_in_radius: {
        Args: {
          _lat: number
          _limit?: number
          _lng: number
          _org: string
          _radius_km?: number
          _subject_types?: string[]
        }
        Returns: {
          city: string
          distance_km: number
          latitude: number
          longitude: number
          state: string
          subject_id: string
          subject_type: string
        }[]
      }
      get_goal_attainment_v2: {
        Args: { _goal_id: string }
        Returns: {
          attainment_pct: number
          goal_id: string
          period_end: string
          period_start: string
          realized_deals_count: number
          realized_value: number
          target_deals_count: number
          target_value: number
        }[]
      }
      get_influencer_lp: {
        Args: { _inf_slug: string; _org_slug: string }
        Returns: {
          bio: string
          coupon_code: string
          cta_text: string
          cta_url: string
          handle: string
          headline: string
          hero_image_url: string
          name: string
          organization_name: string
          platform: string
          slug: string
        }[]
      }
      get_org_consolidated_rollup: {
        Args: { _days?: number; _root_org: string }
        Returns: {
          distinct_customers: number
          orders_count: number
          org_id: string
          org_name: string
          org_type: Database["public"]["Enums"]["org_type"]
          revenue: number
        }[]
      }
      get_public_proposal: { Args: { _token: string }; Returns: Json }
      get_regional_sales_rollup: {
        Args: { _days?: number; _org: string }
        Returns: {
          city: string
          customers: number
          orders: number
          revenue: number
          state: string
        }[]
      }
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
      is_org_or_descendant_member: {
        Args: { _root: string; _user: string }
        Returns: boolean
      }
      org_ancestors: {
        Args: { _org: string }
        Returns: {
          depth: number
          org_type: Database["public"]["Enums"]["org_type"]
          organization_id: string
        }[]
      }
      org_descendants: {
        Args: { _root: string }
        Returns: {
          organization_id: string
        }[]
      }
      org_tenant_root: { Args: { _org: string }; Returns: string }
      purge_expired_ai_artifacts: {
        Args: never
        Returns: {
          removed: number
          table_name: string
        }[]
      }
      refresh_customer_360: { Args: { _org: string }; Returns: number }
      respond_public_proposal: {
        Args: { _action: string; _email: string; _name: string; _token: string }
        Returns: boolean
      }
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
      org_type: "tenant" | "company" | "branch"
      routing_strategy:
        | "round_robin"
        | "weighted"
        | "first_available"
        | "manual"
      sales_order_status:
        | "draft"
        | "confirmed"
        | "in_production"
        | "shipped"
        | "delivered"
        | "cancelled"
      signature_status:
        | "draft"
        | "sent"
        | "viewed"
        | "signed"
        | "declined"
        | "expired"
        | "cancelled"
      signer_status: "pending" | "viewed" | "signed" | "declined"
      stock_movement_kind: "in" | "out" | "adjust"
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
      org_type: ["tenant", "company", "branch"],
      routing_strategy: [
        "round_robin",
        "weighted",
        "first_available",
        "manual",
      ],
      sales_order_status: [
        "draft",
        "confirmed",
        "in_production",
        "shipped",
        "delivered",
        "cancelled",
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
      stock_movement_kind: ["in", "out", "adjust"],
    },
  },
} as const
