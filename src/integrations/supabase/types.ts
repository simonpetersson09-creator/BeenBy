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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      apple_notifications: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          notification_type: string | null
          notification_uuid: string | null
          original_transaction_id: string | null
          status: string
          subtype: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          notification_type?: string | null
          notification_uuid?: string | null
          original_transaction_id?: string | null
          status: string
          subtype?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          notification_type?: string | null
          notification_uuid?: string | null
          original_transaction_id?: string | null
          status?: string
          subtype?: string | null
        }
        Relationships: []
      }
      circle_bans: {
        Row: {
          family_circle_id: string
          removed_at: string
          removed_by: string | null
          user_id: string
        }
        Insert: {
          family_circle_id: string
          removed_at?: string
          removed_by?: string | null
          user_id: string
        }
        Update: {
          family_circle_id?: string
          removed_at?: string
          removed_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_bans_family_circle_id_fkey"
            columns: ["family_circle_id"]
            isOneToOne: false
            referencedRelation: "family_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          locale: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          locale?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          locale?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      family_circles: {
        Row: {
          created_at: string
          created_by: string
          family_code: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          family_code?: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          family_code?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          family_circle_id: string
          geofence_enabled: boolean
          id: string
          joined_at: string
          personal_color: string
          role: string
          user_id: string
        }
        Insert: {
          family_circle_id: string
          geofence_enabled?: boolean
          id?: string
          joined_at?: string
          personal_color: string
          role?: string
          user_id: string
        }
        Update: {
          family_circle_id?: string
          geofence_enabled?: boolean
          id?: string
          joined_at?: string
          personal_color?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_circle_id_fkey"
            columns: ["family_circle_id"]
            isOneToOne: false
            referencedRelation: "family_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          family_circle_id: string
          id: string
          invite_token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          expires_at?: string
          family_circle_id: string
          id?: string
          invite_token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          family_circle_id?: string
          id?: string
          invite_token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_family_circle_id_fkey"
            columns: ["family_circle_id"]
            isOneToOne: false
            referencedRelation: "family_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          family_circle_id: string
          id: string
          image_path: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          family_circle_id: string
          id?: string
          image_path?: string | null
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          family_circle_id?: string
          id?: string
          image_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_family_circle_id_fkey"
            columns: ["family_circle_id"]
            isOneToOne: false
            referencedRelation: "family_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          address: string | null
          created_at: string
          family_circle_id: string
          geofence_radius: number
          id: string
          location_latitude: number | null
          location_longitude: number | null
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          family_circle_id: string
          geofence_radius?: number
          id?: string
          location_latitude?: number | null
          location_longitude?: number | null
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          family_circle_id?: string
          geofence_radius?: number
          id?: string
          location_latitude?: number | null
          location_longitude?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "persons_family_circle_id_fkey"
            columns: ["family_circle_id"]
            isOneToOne: false
            referencedRelation: "family_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_visits: {
        Row: {
          activities: string[]
          activity_note: string | null
          created_at: string
          family_circle_id: string
          id: string
          person_id: string
          planned_date: string
          status: string
          user_id: string
        }
        Insert: {
          activities?: string[]
          activity_note?: string | null
          created_at?: string
          family_circle_id: string
          id?: string
          person_id: string
          planned_date: string
          status?: string
          user_id?: string
        }
        Update: {
          activities?: string[]
          activity_note?: string | null
          created_at?: string
          family_circle_id?: string
          id?: string
          person_id?: string
          planned_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_visits_family_circle_id_fkey"
            columns: ["family_circle_id"]
            isOneToOne: false
            referencedRelation: "family_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_entitlements: {
        Row: {
          created_at: string
          environment: string | null
          expires_at: string | null
          is_active: boolean
          last_verified_at: string | null
          original_transaction_id: string | null
          platform: string | null
          product_id: string | null
          revoked_at: string | null
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          environment?: string | null
          expires_at?: string | null
          is_active?: boolean
          last_verified_at?: string | null
          original_transaction_id?: string | null
          platform?: string | null
          product_id?: string | null
          revoked_at?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string | null
          expires_at?: string | null
          is_active?: boolean
          last_verified_at?: string | null
          original_transaction_id?: string | null
          platform?: string | null
          product_id?: string | null
          revoked_at?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          trial_anchor_hash: string | null
          trial_started_at: string | null
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
          trial_anchor_hash?: string | null
          trial_started_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          trial_anchor_hash?: string | null
          trial_started_at?: string | null
        }
        Relationships: []
      }
      push_dedupe: {
        Row: {
          created_at: string
          record_id: string
          source_table: string
        }
        Insert: {
          created_at?: string
          record_id: string
          source_table: string
        }
        Update: {
          created_at?: string
          record_id?: string
          source_table?: string
        }
        Relationships: []
      }
      push_log: {
        Row: {
          created_at: string
          detail: string | null
          devices: number
          id: string
          recipients: number
          source_table: string
          status: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          devices?: number
          id?: string
          recipients?: number
          source_table: string
          status: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          devices?: number
          id?: string
          recipients?: number
          source_table?: string
          status?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trial_anchors: {
        Row: {
          anchor_hash: string
          first_seen_at: string
          last_seen_at: string
          trial_started_at: string
        }
        Insert: {
          anchor_hash: string
          first_seen_at?: string
          last_seen_at?: string
          trial_started_at?: string
        }
        Update: {
          anchor_hash?: string
          first_seen_at?: string
          last_seen_at?: string
          trial_started_at?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          activities: string[]
          activity_note: string | null
          client_token: string | null
          created_at: string
          family_circle_id: string
          id: string
          local_day: string
          person_id: string
          source: string
          user_id: string
          visited_at: string
        }
        Insert: {
          activities?: string[]
          activity_note?: string | null
          client_token?: string | null
          created_at?: string
          family_circle_id: string
          id?: string
          local_day: string
          person_id: string
          source?: string
          user_id?: string
          visited_at?: string
        }
        Update: {
          activities?: string[]
          activity_note?: string | null
          client_token?: string | null
          created_at?: string
          family_circle_id?: string
          id?: string
          local_day?: string
          person_id?: string
          source?: string
          user_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_family_circle_id_fkey"
            columns: ["family_circle_id"]
            isOneToOne: false
            referencedRelation: "family_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      circle_member_names: {
        Args: { _circle: string }
        Returns: {
          name: string
          user_id: string
        }[]
      }
      claim_trial_anchor: {
        Args: { _anchor: string }
        Returns: {
          is_trial_active: boolean
          server_now: string
          trial_days_left: number
          trial_ends_at: string
          trial_started_at: string
        }[]
      }
      consume_rate_limit: {
        Args: {
          _bucket: string
          _limit: number
          _subject?: string
          _window_seconds: number
        }
        Returns: boolean
      }
      delete_my_account_for: {
        Args: { _user: string }
        Returns: {
          image_path: string
        }[]
      }
      enforce_rate_limit: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: undefined
      }
      generate_family_code: { Args: never; Returns: string }
      get_trial_status: {
        Args: never
        Returns: {
          is_trial_active: boolean
          server_now: string
          trial_days_left: number
          trial_ends_at: string
          trial_started_at: string
        }[]
      }
      has_app_access: { Args: { _user?: string }; Returns: boolean }
      is_circle_creator: { Args: { _circle: string }; Returns: boolean }
      is_circle_member: { Args: { _circle: string }; Returns: boolean }
      join_circle: {
        Args: { _code?: string; _color: string; _name: string; _token?: string }
        Returns: string
      }
      leave_family_circle: { Args: { _circle: string }; Returns: boolean }
      log_security_event: {
        Args: { _detail?: string; _kind: string; _user?: string }
        Returns: undefined
      }
      orphan_chat_images: {
        Args: { _limit?: number; _older_than_hours?: number }
        Returns: {
          object_name: string
        }[]
      }
      preview_invite: {
        Args: { _code?: string; _token?: string }
        Returns: {
          circle_id: string
          circle_name: string
          person_name: string
          status: string
          taken_colors: string[]
        }[]
      }
      rate_limit_geocode: { Args: never; Returns: boolean }
      remove_family_member: {
        Args: { _circle: string; _user: string }
        Returns: boolean
      }
      revoke_circle_access: { Args: { _circle: string }; Returns: string }
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
