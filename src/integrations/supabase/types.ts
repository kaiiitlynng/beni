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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      benefits: {
        Row: {
          category: string
          cost: string | null
          coverage_status: string
          description: string | null
          hidden_perk: boolean
          id: string
          name: string
          plan_id: string
          restrictions: string | null
          source_page: number
          user_id: string
          visit_limit: number | null
        }
        Insert: {
          category: string
          cost?: string | null
          coverage_status: string
          description?: string | null
          hidden_perk?: boolean
          id?: string
          name: string
          plan_id: string
          restrictions?: string | null
          source_page: number
          user_id: string
          visit_limit?: number | null
        }
        Update: {
          category?: string
          cost?: string | null
          coverage_status?: string
          description?: string | null
          hidden_perk?: boolean
          id?: string
          name?: string
          plan_id?: string
          restrictions?: string | null
          source_page?: number
          user_id?: string
          visit_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "benefits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans_uploaded"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          benefit_id: string | null
          ends_at: string | null
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          kind: string
          location: string | null
          notes: string | null
          starts_at: string
          status: string
          title: string
          user_confirmed: boolean
          user_id: string
        }
        Insert: {
          benefit_id?: string | null
          ends_at?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          kind?: string
          location?: string | null
          notes?: string | null
          starts_at: string
          status?: string
          title: string
          user_confirmed?: boolean
          user_id: string
        }
        Update: {
          benefit_id?: string | null
          ends_at?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          kind?: string
          location?: string | null
          notes?: string | null
          starts_at?: string
          status?: string
          title?: string
          user_confirmed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id: string
          kind: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      linq_messages: {
        Row: {
          body: string
          chat_id: string | null
          created_at: string
          delivery_status: string
          direction: string
          id: string
          provider_message_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          chat_id?: string | null
          created_at?: string
          delivery_status?: string
          direction: string
          id?: string
          provider_message_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          chat_id?: string | null
          created_at?: string
          delivery_status?: string
          direction?: string
          id?: string
          provider_message_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      linq_webhook_receipts: {
        Row: {
          created_at: string
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          delivery_status: string
          direction: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          delivery_status?: string
          direction: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          delivery_status?: string
          direction?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans_uploaded: {
        Row: {
          created_at: string
          deductible: string | null
          effective_end: string | null
          effective_start: string | null
          file_name: string
          id: string
          out_of_pocket_max: string | null
          plan_name: string | null
          plan_type: string | null
          provider: string | null
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deductible?: string | null
          effective_end?: string | null
          effective_start?: string | null
          file_name: string
          id?: string
          out_of_pocket_max?: string | null
          plan_name?: string | null
          plan_type?: string | null
          provider?: string | null
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          deductible?: string | null
          effective_end?: string | null
          effective_start?: string | null
          file_name?: string
          id?: string
          out_of_pocket_max?: string | null
          plan_name?: string | null
          plan_type?: string | null
          provider?: string | null
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_uploaded_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability: string
          break_end: string | null
          break_start: string | null
          created_at: string
          current_city: string
          first_name: string
          home_city: string
          id: string
          interests: string[]
          linq_verified_phone: string | null
          messaging_hours: string
          notify_appointments: boolean
          notify_benefits: boolean
          notify_checkins: boolean
          notify_expiration: boolean
          notify_sms: boolean
          onboarding_complete: boolean
          organization: string
          phone: string
          reminder_frequency: string
          reminder_preferences: string[]
          sms_consent: boolean
          timezone: string
        }
        Insert: {
          availability?: string
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          current_city?: string
          first_name?: string
          home_city?: string
          id: string
          interests?: string[]
          linq_verified_phone?: string | null
          messaging_hours?: string
          notify_appointments?: boolean
          notify_benefits?: boolean
          notify_checkins?: boolean
          notify_expiration?: boolean
          notify_sms?: boolean
          onboarding_complete?: boolean
          organization?: string
          phone?: string
          reminder_frequency?: string
          reminder_preferences?: string[]
          sms_consent?: boolean
          timezone?: string
        }
        Update: {
          availability?: string
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          current_city?: string
          first_name?: string
          home_city?: string
          id?: string
          interests?: string[]
          linq_verified_phone?: string | null
          messaging_hours?: string
          notify_appointments?: boolean
          notify_benefits?: boolean
          notify_checkins?: boolean
          notify_expiration?: boolean
          notify_sms?: boolean
          onboarding_complete?: boolean
          organization?: string
          phone?: string
          reminder_frequency?: string
          reminder_preferences?: string[]
          sms_consent?: boolean
          timezone?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          booking_url: string | null
          city: string | null
          contact: string | null
          id: string
          name: string
          network_verified: boolean
          user_id: string
        }
        Insert: {
          booking_url?: string | null
          city?: string | null
          contact?: string | null
          id?: string
          name: string
          network_verified?: boolean
          user_id: string
        }
        Update: {
          booking_url?: string | null
          city?: string | null
          contact?: string | null
          id?: string
          name?: string
          network_verified?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          id: string
          remind_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          id?: string
          remind_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          id?: string
          remind_at?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          benefit_id: string | null
          confirmed: boolean
          created_at: string
          id: string
          user_id: string
          visit_date: string
        }
        Insert: {
          benefit_id?: string | null
          confirmed?: boolean
          created_at?: string
          id?: string
          user_id: string
          visit_date: string
        }
        Update: {
          benefit_id?: string | null
          confirmed?: boolean
          created_at?: string
          id?: string
          user_id?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
