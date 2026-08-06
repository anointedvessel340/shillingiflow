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
      accounts: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          is_default: boolean
          name: string
          opening_balance: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          opening_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          opening_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      approved_emails: {
        Row: {
          added_at: string
          added_by: string | null
          email: string
          id: string
          role: Database["public"]["Enums"]["access_role"]
          status: Database["public"]["Enums"]["access_status"]
          updated_at: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          email: string
          id?: string
          role?: Database["public"]["Enums"]["access_role"]
          status?: Database["public"]["Enums"]["access_status"]
          updated_at?: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["access_role"]
          status?: Database["public"]["Enums"]["access_status"]
          updated_at?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          end_date: string | null
          id: string
          period_type: Database["public"]["Enums"]["budget_period"]
          start_date: string
          updated_at: string
          user_id: string
          workspace: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          period_type?: Database["public"]["Enums"]["budget_period"]
          start_date?: string
          updated_at?: string
          user_id: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          period_type?: Database["public"]["Enums"]["budget_period"]
          start_date?: string
          updated_at?: string
          user_id?: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
          user_id: string
          workspace: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_learnings: {
        Row: {
          category_id: string
          created_at: string
          id: string
          term: string
          user_id: string
          workspace: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          term: string
          user_id: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          term?: string
          user_id?: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: [
          {
            foreignKeyName: "category_learnings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          business_name: string | null
          created_at: string
          email: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          date: string
          debt_id: string
          id: string
          notes: string | null
          remaining_balance_after: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          debt_id: string
          id?: string
          notes?: string | null
          remaining_balance_after: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          debt_id?: string
          id?: string
          notes?: string | null
          remaining_balance_after?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          current_balance: number
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date: string | null
          id: string
          interest_rate: number | null
          notes: string | null
          original_amount: number
          person_or_institution: string
          status: Database["public"]["Enums"]["debt_status"]
          updated_at: string
          user_id: string
          workspace: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          created_at?: string
          current_balance: number
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          notes?: string | null
          original_amount: number
          person_or_institution: string
          status?: Database["public"]["Enums"]["debt_status"]
          updated_at?: string
          user_id: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          created_at?: string
          current_balance?: number
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          notes?: string | null
          original_amount?: number
          person_or_institution?: string
          status?: Database["public"]["Enums"]["debt_status"]
          updated_at?: string
          user_id?: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: []
      }
      equipment: {
        Row: {
          assigned_project_id: string | null
          brand: string | null
          category: string | null
          condition: Database["public"]["Enums"]["equipment_condition"]
          created_at: string
          current_value: number | null
          depreciation_method: string
          id: string
          model: string | null
          name: string
          notes: string | null
          photo_url: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          storage_location: string | null
          subcategory: string | null
          updated_at: string
          useful_life_years: number | null
          user_id: string
          warranty_end_date: string | null
          workspace: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          assigned_project_id?: string | null
          brand?: string | null
          category?: string | null
          condition?: Database["public"]["Enums"]["equipment_condition"]
          created_at?: string
          current_value?: number | null
          depreciation_method?: string
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          photo_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          storage_location?: string | null
          subcategory?: string | null
          updated_at?: string
          useful_life_years?: number | null
          user_id: string
          warranty_end_date?: string | null
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          assigned_project_id?: string | null
          brand?: string | null
          category?: string | null
          condition?: Database["public"]["Enums"]["equipment_condition"]
          created_at?: string
          current_value?: number | null
          depreciation_method?: string
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          storage_location?: string | null
          subcategory?: string | null
          updated_at?: string
          useful_life_years?: number | null
          user_id?: string
          warranty_end_date?: string | null
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assigned_project_id_fkey"
            columns: ["assigned_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance: {
        Row: {
          cost: number | null
          created_at: string
          date: string
          equipment_id: string
          id: string
          notes: string | null
          technician_or_provider: string | null
          type: Database["public"]["Enums"]["maintenance_type"]
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          date?: string
          equipment_id: string
          id?: string
          notes?: string | null
          technician_or_provider?: string | null
          type?: Database["public"]["Enums"]["maintenance_type"]
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          date?: string
          equipment_id?: string
          id?: string
          notes?: string | null
          technician_or_provider?: string | null
          type?: Database["public"]["Enums"]["maintenance_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          date: string
          goal_id: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          date?: string
          goal_id: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          goal_id?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category_id: string | null
          color: string | null
          created_at: string
          current_amount: number
          deadline: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          recurring_amount: number | null
          recurring_freq: Database["public"]["Enums"]["recurrence_freq"] | null
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          updated_at: string
          user_id: string
          workspace: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          created_at?: string
          current_amount?: number
          deadline?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          recurring_amount?: number | null
          recurring_freq?: Database["public"]["Enums"]["recurrence_freq"] | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          updated_at?: string
          user_id: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          category_id?: string | null
          color?: string | null
          created_at?: string
          current_amount?: number
          deadline?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          recurring_amount?: number | null
          recurring_freq?: Database["public"]["Enums"]["recurrence_freq"] | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number
          updated_at?: string
          user_id?: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: [
          {
            foreignKeyName: "goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_price?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          date: string
          id: string
          invoice_id: string
          notes: string | null
          payment_method: string | null
          reference: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          date?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_method?: string | null
          reference?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_method?: string | null
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          document_type: Database["public"]["Enums"]["legal_document_type"]
          id: string
          ip_address: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          document_type: Database["public"]["Enums"]["legal_document_type"]
          id?: string
          ip_address?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          document_type?: Database["public"]["Enums"]["legal_document_type"]
          id?: string
          ip_address?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          device_info: string | null
          email: string
          id: string
          ip: string | null
          reason: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          email: string
          id?: string
          ip?: string | null
          reason?: string | null
          success: boolean
        }
        Update: {
          created_at?: string
          device_info?: string | null
          email?: string
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean
        }
        Relationships: []
      }
      passkeys: {
        Row: {
          backed_up: boolean
          counter: number
          created_at: string
          credential_id: string
          device_label: string
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[]
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id: string
          device_label?: string
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[]
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id?: string
          device_label?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[]
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_workspace: Database["public"]["Enums"]["workspace_type"]
          auto_lock_minutes: number
          created_at: string
          currency: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active_workspace?: Database["public"]["Enums"]["workspace_type"]
          auto_lock_minutes?: number
          created_at?: string
          currency?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          active_workspace?: Database["public"]["Enums"]["workspace_type"]
          auto_lock_minutes?: number
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          category: string | null
          client_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          estimated_cost: number | null
          estimated_revenue: number | null
          id: string
          name: string
          notes: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
          venue: string | null
        }
        Insert: {
          category?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          estimated_cost?: number | null
          estimated_revenue?: number | null
          id?: string
          name: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
          venue?: string | null
        }
        Update: {
          category?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          estimated_cost?: number | null
          estimated_revenue?: number | null
          id?: string
          name?: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurrence_freq"]
          id: string
          next_occurrence_date: string
          status: Database["public"]["Enums"]["recurring_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
          workspace: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          frequency: Database["public"]["Enums"]["recurrence_freq"]
          id?: string
          next_occurrence_date: string
          status?: Database["public"]["Enums"]["recurring_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_freq"]
          id?: string
          next_occurrence_date?: string
          status?: Database["public"]["Enums"]["recurring_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_accounts: {
        Row: {
          account_kind: Database["public"]["Enums"]["savings_account_kind"]
          compounding_frequency: Database["public"]["Enums"]["savings_compounding"]
          created_at: string
          held_at: string | null
          id: string
          interest_rate: number | null
          name: string
          notes: string | null
          opened_date: string
          status: Database["public"]["Enums"]["savings_account_status"]
          updated_at: string
          user_id: string
          workspace: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          account_kind?: Database["public"]["Enums"]["savings_account_kind"]
          compounding_frequency?: Database["public"]["Enums"]["savings_compounding"]
          created_at?: string
          held_at?: string | null
          id?: string
          interest_rate?: number | null
          name: string
          notes?: string | null
          opened_date?: string
          status?: Database["public"]["Enums"]["savings_account_status"]
          updated_at?: string
          user_id: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          account_kind?: Database["public"]["Enums"]["savings_account_kind"]
          compounding_frequency?: Database["public"]["Enums"]["savings_compounding"]
          created_at?: string
          held_at?: string | null
          id?: string
          interest_rate?: number | null
          name?: string
          notes?: string | null
          opened_date?: string
          status?: Database["public"]["Enums"]["savings_account_status"]
          updated_at?: string
          user_id?: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: []
      }
      savings_ledger: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          date: string
          entry_type: Database["public"]["Enums"]["savings_entry_type"]
          id: string
          linked_transaction_id: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          date?: string
          entry_type: Database["public"]["Enums"]["savings_entry_type"]
          id?: string
          linked_transaction_id?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          date?: string
          entry_type?: Database["public"]["Enums"]["savings_entry_type"]
          id?: string
          linked_transaction_id?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_ledger_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      security_log: {
        Row: {
          created_at: string
          device_info: string | null
          event_type: string
          id: string
          ip: string | null
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          event_type: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          client_id: string | null
          created_at: string
          date: string
          deleted_at: string | null
          description: string | null
          id: string
          invoice_payment_id: string | null
          notes: string | null
          occurred_time: string | null
          project_id: string | null
          receipt_url: string | null
          recurring_rule_id: string | null
          tags: string[]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
          workspace: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_payment_id?: string | null
          notes?: string | null
          occurred_time?: string | null
          project_id?: string | null
          receipt_url?: string | null
          recurring_rule_id?: string | null
          tags?: string[]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_payment_id?: string | null
          notes?: string | null
          occurred_time?: string | null
          project_id?: string | null
          receipt_url?: string | null
          recurring_rule_id?: string | null
          tags?: string[]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
          workspace?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_invoice_payment_id_fkey"
            columns: ["invoice_payment_id"]
            isOneToOne: false
            referencedRelation: "invoice_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_email: { Args: never; Returns: string }
      email_is_approved: { Args: { _email: string }; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      run_recurring_rules: { Args: never; Returns: number }
      savings_record_entry: {
        Args: {
          _account_id: string
          _amount: number
          _date: string
          _entry_type: Database["public"]["Enums"]["savings_entry_type"]
          _notes: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      access_role: "owner" | "admin"
      access_status: "active" | "revoked"
      account_type: "mpesa" | "cash" | "bank" | "sacco" | "custom"
      budget_period: "weekly" | "monthly" | "custom"
      client_status: "lead" | "prospect" | "active" | "vip" | "inactive"
      debt_direction: "owed_to_me" | "i_owe"
      debt_status: "open" | "settled" | "written_off"
      equipment_condition: "new" | "excellent" | "good" | "fair" | "poor"
      equipment_status: "available" | "assigned" | "in_repair" | "retired"
      goal_status: "active" | "paused" | "archived" | "completed"
      invoice_status:
        | "draft"
        | "unpaid"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      legal_document_type: "privacy_policy" | "terms_of_service"
      maintenance_type: "repair" | "routine" | "inspection"
      project_status:
        | "quoted"
        | "booked"
        | "in_progress"
        | "delivered"
        | "paid"
        | "cancelled"
      recurrence_freq:
        | "daily"
        | "weekly"
        | "biweekly"
        | "monthly"
        | "quarterly"
        | "yearly"
      recurring_status: "active" | "paused"
      savings_account_kind: "savings" | "investment"
      savings_account_status: "active" | "closed"
      savings_compounding: "monthly" | "none"
      savings_entry_type: "deposit" | "withdrawal" | "manual_valuation"
      transaction_type:
        | "income"
        | "expense"
        | "transfer"
        | "savings_deposit"
        | "savings_withdrawal"
      workspace_type: "personal" | "business"
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
      access_role: ["owner", "admin"],
      access_status: ["active", "revoked"],
      account_type: ["mpesa", "cash", "bank", "sacco", "custom"],
      budget_period: ["weekly", "monthly", "custom"],
      client_status: ["lead", "prospect", "active", "vip", "inactive"],
      debt_direction: ["owed_to_me", "i_owe"],
      debt_status: ["open", "settled", "written_off"],
      equipment_condition: ["new", "excellent", "good", "fair", "poor"],
      equipment_status: ["available", "assigned", "in_repair", "retired"],
      goal_status: ["active", "paused", "archived", "completed"],
      invoice_status: [
        "draft",
        "unpaid",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      legal_document_type: ["privacy_policy", "terms_of_service"],
      maintenance_type: ["repair", "routine", "inspection"],
      project_status: [
        "quoted",
        "booked",
        "in_progress",
        "delivered",
        "paid",
        "cancelled",
      ],
      recurrence_freq: [
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "yearly",
      ],
      recurring_status: ["active", "paused"],
      savings_account_kind: ["savings", "investment"],
      savings_account_status: ["active", "closed"],
      savings_compounding: ["monthly", "none"],
      savings_entry_type: ["deposit", "withdrawal", "manual_valuation"],
      transaction_type: [
        "income",
        "expense",
        "transfer",
        "savings_deposit",
        "savings_withdrawal",
      ],
      workspace_type: ["personal", "business"],
    },
  },
} as const
