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
      access_tokens: {
        Row: {
          consumed_at: string | null
          consumed_by: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          revoked: boolean
          token: string
          updated_at: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          revoked?: boolean
          token: string
          updated_at?: string
        }
        Update: {
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          revoked?: boolean
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_support_settings: {
        Row: {
          ai_globally_enabled: boolean
          business_description: string
          business_hours: string
          contact_details: string
          escalation_rules: string
          faqs: Json
          id: string
          max_response_length: number
          response_style: string
          supported_languages: string[]
          updated_at: string
          welcome_message: string
        }
        Insert: {
          ai_globally_enabled?: boolean
          business_description?: string
          business_hours?: string
          contact_details?: string
          escalation_rules?: string
          faqs?: Json
          id?: string
          max_response_length?: number
          response_style?: string
          supported_languages?: string[]
          updated_at?: string
          welcome_message?: string
        }
        Update: {
          ai_globally_enabled?: boolean
          business_description?: string
          business_hours?: string
          contact_details?: string
          escalation_rules?: string
          faqs?: Json
          id?: string
          max_response_length?: number
          response_style?: string
          supported_languages?: string[]
          updated_at?: string
          welcome_message?: string
        }
        Relationships: []
      }
      api_endpoints: {
        Row: {
          created_at: string
          description: string | null
          headers: Json
          id: string
          method: string
          parameters: Json
          project_id: string
          request_body: Json
          response_body: Json
          route: string
          updated_at: string
          validation: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          headers?: Json
          id?: string
          method?: string
          parameters?: Json
          project_id: string
          request_body?: Json
          response_body?: Json
          route: string
          updated_at?: string
          validation?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          headers?: Json
          id?: string
          method?: string
          parameters?: Json
          project_id?: string
          request_body?: Json
          response_body?: Json
          route?: string
          updated_at?: string
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "api_endpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "api_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      api_env_vars: {
        Row: {
          created_at: string
          id: string
          key: string
          project_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          project_id: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          project_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_env_vars_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "api_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      api_project_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "api_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      api_projects: {
        Row: {
          api_type: string
          auth_type: string
          base_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          api_type?: string
          auth_type?: string
          base_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id: string
          version?: string
        }
        Update: {
          api_type?: string
          auth_type?: string
          base_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          mode: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      login_history: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json
          role: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          created_at: string
          currency: string
          id: string
          marked_paid_by: string | null
          method: string
          reference: string | null
          request_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          marked_paid_by?: string | null
          method?: string
          reference?: string | null
          request_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          marked_paid_by?: string | null
          method?: string
          reference?: string | null
          request_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "website_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          contact_number: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          suspended: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          contact_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          suspended?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          contact_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          suspended?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      project_files: {
        Row: {
          content: string
          created_at: string
          id: string
          language: string | null
          path: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          language?: string | null
          path: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          language?: string | null
          path?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          framework: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          framework?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          framework?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          body_md: string | null
          created_at: string
          description: string | null
          faqs: Json
          features: Json
          hero_image_url: string | null
          icon: string | null
          id: string
          image_url: string | null
          link_type: string
          link_url: string | null
          pricing: Json
          published: boolean
          slug: string
          sort_order: number
          tagline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body_md?: string | null
          created_at?: string
          description?: string | null
          faqs?: Json
          features?: Json
          hero_image_url?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          link_type?: string
          link_url?: string | null
          pricing?: Json
          published?: boolean
          slug: string
          sort_order?: number
          tagline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string | null
          created_at?: string
          description?: string | null
          faqs?: Json
          features?: Json
          hero_image_url?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          link_type?: string
          link_url?: string | null
          pricing?: Json
          published?: boolean
          slug?: string
          sort_order?: number
          tagline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          cloud_solutions_url: string | null
          contact_email: string | null
          contact_phone: string | null
          description: string | null
          favicon_url: string | null
          footer_text: string | null
          hero_subtitle: string | null
          hero_title: string | null
          homepage_banner: string | null
          id: number
          logo_url: string | null
          maintenance_mode: boolean
          seo_description: string | null
          seo_title: string | null
          site_name: string
          socials: Json
          theme: Json
          updated_at: string
          whatsapp_bot_url: string | null
        }
        Insert: {
          cloud_solutions_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          description?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          homepage_banner?: string | null
          id?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          seo_description?: string | null
          seo_title?: string | null
          site_name?: string
          socials?: Json
          theme?: Json
          updated_at?: string
          whatsapp_bot_url?: string | null
        }
        Update: {
          cloud_solutions_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          description?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          homepage_banner?: string | null
          id?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          seo_description?: string | null
          seo_title?: string | null
          site_name?: string
          socials?: Json
          theme?: Json
          updated_at?: string
          whatsapp_bot_url?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          language: string | null
          sender_id: string
          sender_role: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          language?: string | null
          sender_id: string
          sender_role?: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          language?: string | null
          sender_id?: string
          sender_role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          admin_active: boolean
          ai_enabled: boolean
          created_at: string
          id: string
          language: string | null
          last_message_at: string
          mode: string
          status: string
          subject: string | null
          unread_admin: number
          unread_user: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_active?: boolean
          ai_enabled?: boolean
          created_at?: string
          id?: string
          language?: string | null
          last_message_at?: string
          mode?: string
          status?: string
          subject?: string | null
          unread_admin?: number
          unread_user?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_active?: boolean
          ai_enabled?: boolean
          created_at?: string
          id?: string
          language?: string | null
          last_message_at?: string
          mode?: string
          status?: string
          subject?: string | null
          unread_admin?: number
          unread_user?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      token_requests: {
        Row: {
          created_at: string
          id: string
          issued_token_id: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_token_id?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_token_id?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_requests_issued_token_id_fkey"
            columns: ["issued_token_id"]
            isOneToOne: false
            referencedRelation: "access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_requests: {
        Row: {
          admin_notes: string | null
          booking_type: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          deposit_percent: number | null
          details: Json
          estimated_days: number | null
          estimated_price: number | null
          features: Json
          id: string
          quote_token: string | null
          quoted_at: string | null
          service_kind: string
          status: string
          updated_at: string
          user_id: string
          website_type: string | null
        }
        Insert: {
          admin_notes?: string | null
          booking_type?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          deposit_percent?: number | null
          details?: Json
          estimated_days?: number | null
          estimated_price?: number | null
          features?: Json
          id?: string
          quote_token?: string | null
          quoted_at?: string | null
          service_kind?: string
          status?: string
          updated_at?: string
          user_id: string
          website_type?: string | null
        }
        Update: {
          admin_notes?: string | null
          booking_type?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          deposit_percent?: number | null
          details?: Json
          estimated_days?: number | null
          estimated_price?: number | null
          features?: Json
          id?: string
          quote_token?: string | null
          quoted_at?: string | null
          service_kind?: string
          status?: string
          updated_at?: string
          user_id?: string
          website_type?: string | null
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
    }
    Enums: {
      app_role: "administrator" | "moderator" | "premium" | "standard"
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
      app_role: ["administrator", "moderator", "premium", "standard"],
    },
  },
} as const
