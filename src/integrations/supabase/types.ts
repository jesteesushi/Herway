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
      clarification_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          from_moderator: boolean
          id: string
          report_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          from_moderator?: boolean
          id?: string
          report_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          from_moderator?: boolean
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clarification_messages_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "incident_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      community_rooms: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      content_flags: {
        Row: {
          created_at: string
          details: string | null
          id: string
          post_id: string | null
          reason: string
          reply_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string | null
          reason: string
          reply_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string | null
          reason?: string
          reply_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_flags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "room_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_flags_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "post_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_flags: {
        Row: {
          created_at: string
          details: string | null
          id: string
          published_id: string
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          published_id: string
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          published_id?: string
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_flags_published_id_fkey"
            columns: ["published_id"]
            isOneToOne: false
            referencedRelation: "published_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          category: Database["public"]["Enums"]["incident_category"]
          consent_context: string | null
          context_details: string | null
          created_at: string
          date_from: string
          date_to: string
          description: string | null
          id: string
          lat: number
          lng: number
          place_label: string | null
          published_id: string | null
          ref_code: string
          report_type: Database["public"]["Enums"]["report_type"]
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          time_range: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["incident_category"]
          consent_context?: string | null
          context_details?: string | null
          created_at?: string
          date_from: string
          date_to: string
          description?: string | null
          id?: string
          lat: number
          lng: number
          place_label?: string | null
          published_id?: string | null
          ref_code?: string
          report_type: Database["public"]["Enums"]["report_type"]
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          time_range?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["incident_category"]
          consent_context?: string | null
          context_details?: string | null
          created_at?: string
          date_from?: string
          date_to?: string
          description?: string | null
          id?: string
          lat?: number
          lng?: number
          place_label?: string | null
          published_id?: string | null
          ref_code?: string
          report_type?: Database["public"]["Enums"]["report_type"]
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          time_range?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_published_id_fkey"
            columns: ["published_id"]
            isOneToOne: false
            referencedRelation: "published_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          created_at: string
          id: string
          moderator_id: string
          published_id: string | null
          reason: string
          report_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          moderator_id: string
          published_id?: string | null
          reason: string
          report_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          moderator_id?: string
          published_id?: string | null
          reason?: string
          report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "incident_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      post_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
          removed_at: string | null
          removed_by: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          removed_at?: string | null
          removed_by?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          removed_at?: string | null
          removed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "room_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          allow_direct_messages?: boolean
          notify_on_replies?: boolean
          notify_on_status_change?: boolean
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          allow_direct_messages?: boolean
          notify_on_replies?: boolean
          notify_on_status_change?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          allow_direct_messages?: boolean
          notify_on_replies?: boolean
          notify_on_status_change?: boolean
        }
        Relationships: []
      }
      incident_appeals: {
        Row: {
          created_at: string
          id: string
          moderator_id: string | null
          moderator_notes: string | null
          reason: string
          report_id: string
          reporter_id: string
          resolved_at: string | null
          status: "pending" | "approved" | "rejected"
        }
        Insert: {
          created_at?: string
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          reason: string
          report_id: string
          reporter_id: string
          resolved_at?: string | null
          status?: "pending" | "approved" | "rejected"
        }
        Update: {
          created_at?: string
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          reason?: string
          report_id?: string
          reporter_id?: string
          resolved_at?: string | null
          status?: "pending" | "approved" | "rejected"
        }
        Relationships: [
          {
            foreignKeyName: "incident_appeals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "incident_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mutes: {
        Row: {
          created_at: string
          id: string
          muted_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muted_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muted_id?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: "pending" | "accepted" | "declined"
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: "pending" | "accepted" | "declined"
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: "pending" | "accepted" | "declined"
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
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
        ]
      }
      direct_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      published_incidents: {
        Row: {
          area_label: string
          category: Database["public"]["Enums"]["incident_category"]
          date_from: string
          date_to: string
          id: string
          is_sample: boolean
          lat: number
          lng: number
          published_at: string
          report_type: Database["public"]["Enums"]["report_type"]
          summary: string | null
          updated_at: string
        }
        Insert: {
          area_label: string
          category: Database["public"]["Enums"]["incident_category"]
          date_from: string
          date_to: string
          id?: string
          is_sample?: boolean
          lat: number
          lng: number
          published_at?: string
          report_type: Database["public"]["Enums"]["report_type"]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          area_label?: string
          category?: Database["public"]["Enums"]["incident_category"]
          date_from?: string
          date_to?: string
          id?: string
          is_sample?: boolean
          lat?: number
          lng?: number
          published_at?: string
          report_type?: Database["public"]["Enums"]["report_type"]
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      room_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          removed_at: string | null
          removed_by: string | null
          room_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          removed_at?: string | null
          removed_by?: string | null
          room_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          removed_at?: string | null
          removed_by?: string | null
          room_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_posts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "community_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_places: {
        Row: {
          created_at: string
          id: string
          label: string
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: []
      }
      support_resources: {
        Row: {
          description: string
          hours: string | null
          id: string
          is_verified: boolean
          kind: string
          last_checked: string | null
          name: string
          phone: string | null
          sort_order: number
          url: string | null
        }
        Insert: {
          description: string
          hours?: string | null
          id?: string
          is_verified?: boolean
          kind: string
          last_checked?: string | null
          name: string
          phone?: string | null
          sort_order?: number
          url?: string | null
        }
        Update: {
          description?: string
          hours?: string | null
          id?: string
          is_verified?: boolean
          kind?: string
          last_checked?: string | null
          name?: string
          phone?: string | null
          sort_order?: number
          url?: string | null
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_moderator: { Args: { _user_id: string }; Returns: boolean }
      approve_and_publish_report: {
        Args: {
          _report_id: string
          _area_label: string
          _summary: string | null
          _reason: string
        }
        Returns: { published_id: string; lat: number; lng: number; status: string }
      }
      can_bootstrap_moderator: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      claim_first_moderator: {
        Args: { _secret_token: string }
        Returns: boolean
      }
      assign_user_role: {
        Args: {
          _target_user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      incident_category: "harassment" | "stalking" | "sexual_assault" | "other"
      report_status:
        | "awaiting_review"
        | "needs_clarification"
        | "published"
        | "not_published"
        | "removed"
      report_type: "firsthand" | "witnessed" | "disclosed"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      incident_category: ["harassment", "stalking", "sexual_assault", "other"],
      report_status: [
        "awaiting_review",
        "needs_clarification",
        "published",
        "not_published",
        "removed",
      ],
      report_type: ["firsthand", "witnessed", "disclosed"],
    },
  },
} as const
