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
      academy_achievements: {
        Row: {
          code: string
          description: string | null
          earned_at: string
          icon: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          code: string
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          code?: string
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      academy_activity: {
        Row: {
          day: string
          id: string
          minutes: number
          user_id: string
        }
        Insert: {
          day?: string
          id?: string
          minutes?: number
          user_id: string
        }
        Update: {
          day?: string
          id?: string
          minutes?: number
          user_id?: string
        }
        Relationships: []
      }
      academy_certificates: {
        Row: {
          certificate_code: string
          course_id: string
          course_title: string
          id: string
          issued_at: string
          student_name: string
          user_id: string
        }
        Insert: {
          certificate_code: string
          course_id: string
          course_title: string
          id?: string
          issued_at?: string
          student_name: string
          user_id: string
        }
        Update: {
          certificate_code?: string
          course_id?: string
          course_title?: string
          id?: string
          issued_at?: string
          student_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_courses: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          difficulty: string
          estimated_hours: number
          icon: string | null
          id: string
          published: boolean
          slug: string
          sort_order: number
          tagline: string | null
          title: string
          topic: string | null
          track: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string
          estimated_hours?: number
          icon?: string | null
          id?: string
          published?: boolean
          slug: string
          sort_order?: number
          tagline?: string | null
          title: string
          topic?: string | null
          track?: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string
          estimated_hours?: number
          icon?: string | null
          id?: string
          published?: boolean
          slug?: string
          sort_order?: number
          tagline?: string | null
          title?: string
          topic?: string | null
          track?: string
          updated_at?: string
        }
        Relationships: []
      }
      academy_enrollments: {
        Row: {
          course_id: string | null
          created_at: string
          experience_level: string
          hours_per_day: number
          id: string
          onboarded: boolean
          request_id: string | null
          status: string
          study_days: Json
          target_completion: string | null
          track: string
          updated_at: string
          user_id: string
          welcomed: boolean
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          experience_level?: string
          hours_per_day?: number
          id?: string
          onboarded?: boolean
          request_id?: string | null
          status?: string
          study_days?: Json
          target_completion?: string | null
          track?: string
          updated_at?: string
          user_id: string
          welcomed?: boolean
        }
        Update: {
          course_id?: string | null
          created_at?: string
          experience_level?: string
          hours_per_day?: number
          id?: string
          onboarded?: boolean
          request_id?: string | null
          status?: string
          study_days?: Json
          target_completion?: string | null
          track?: string
          updated_at?: string
          user_id?: string
          welcomed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "academy_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_enrollments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "website_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lessons: {
        Row: {
          code_examples: Json
          content_md: string | null
          course_id: string
          created_at: string
          estimated_minutes: number
          exercises: Json
          generated: boolean
          homework: string | null
          id: string
          module_id: string
          objectives: Json
          quiz: Json
          resources: Json
          slug: string
          sort_order: number
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          code_examples?: Json
          content_md?: string | null
          course_id: string
          created_at?: string
          estimated_minutes?: number
          exercises?: Json
          generated?: boolean
          homework?: string | null
          id?: string
          module_id: string
          objectives?: Json
          quiz?: Json
          resources?: Json
          slug: string
          sort_order?: number
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          code_examples?: Json
          content_md?: string | null
          course_id?: string
          created_at?: string
          estimated_minutes?: number
          exercises?: Json
          generated?: boolean
          homework?: string | null
          id?: string
          module_id?: string
          objectives?: Json
          quiz?: Json
          resources?: Json
          slug?: string
          sort_order?: number
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          level: string
          sort_order: number
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          level?: string
          sort_order?: number
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          level?: string
          sort_order?: number
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          course_id: string
          created_at: string
          id: string
          lesson_id: string
          minutes_spent: number
          quiz_score: number | null
          quiz_total: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          lesson_id: string
          minutes_spent?: number
          quiz_score?: number | null
          quiz_total?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          lesson_id?: string
          minutes_spent?: number
          quiz_score?: number | null
          quiz_total?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_study_plan: {
        Row: {
          completed: boolean
          created_at: string
          enrollment_id: string
          id: string
          lesson_ids: Json
          minutes: number
          scheduled_for: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          enrollment_id: string
          id?: string
          lesson_ids?: Json
          minutes?: number
          scheduled_for: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          enrollment_id?: string
          id?: string
          lesson_ids?: Json
          minutes?: number
          scheduled_for?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_study_plan_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "academy_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
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
      analytics_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event: string
          format: string | null
          id: string
          job_id: string | null
          metadata: Json
          platform: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event: string
          format?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json
          platform?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event?: string
          format?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json
          platform?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "download_jobs"
            referencedColumns: ["id"]
          },
        ]
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
          is_favorite: boolean
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
          is_favorite?: boolean
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
          is_favorite?: boolean
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          ip_hash: string | null
          metadata: Json
          target: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          target?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          target?: string | null
        }
        Relationships: []
      }
      cloud_apps: {
        Row: {
          branch: string
          created_at: string
          domain: string | null
          env_vars: Json
          health: string
          id: string
          last_deploy_at: string | null
          name: string
          plan_id: string | null
          region: string
          repo_url: string
          runtime: string
          slug: string
          start_command: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch?: string
          created_at?: string
          domain?: string | null
          env_vars?: Json
          health?: string
          id?: string
          last_deploy_at?: string | null
          name: string
          plan_id?: string | null
          region?: string
          repo_url?: string
          runtime?: string
          slug: string
          start_command?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch?: string
          created_at?: string
          domain?: string | null
          env_vars?: Json
          health?: string
          id?: string
          last_deploy_at?: string | null
          name?: string
          plan_id?: string | null
          region?: string
          repo_url?: string
          runtime?: string
          slug?: string
          start_command?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_apps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "hosting_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_deployments: {
        Row: {
          app_id: string
          created_at: string
          duration_ms: number | null
          finished_at: string | null
          id: string
          logs: string
          status: string
          trigger: string
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          logs?: string
          status?: string
          trigger?: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          logs?: string
          status?: string
          trigger?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_deployments_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "cloud_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          kind: string
          method: string
          note: string | null
          reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          method?: string
          note?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          method?: string
          note?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cloud_vps: {
        Row: {
          created_at: string
          hostname: string
          id: string
          ip_address: string | null
          notes: string | null
          os_image: string
          plan_id: string | null
          region: string
          root_user: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hostname: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          os_image?: string
          plan_id?: string | null
          region?: string
          root_user?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hostname?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          os_image?: string
          plan_id?: string | null
          region?: string
          root_user?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_vps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "hosting_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
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
      download_jobs: {
        Row: {
          attempts: number
          client_ip_hash: string | null
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          expires_at: string | null
          guest_key: string | null
          id: string
          idempotency_key: string | null
          max_attempts: number
          media_title: string | null
          media_type: string | null
          metadata: Json
          normalized_url: string
          output_filename: string | null
          output_size: number | null
          progress: number
          requested_format: string
          requested_quality: string | null
          source_platform: string | null
          source_url: string
          started_at: string | null
          status: string
          temporary_storage_path: string | null
          updated_at: string
          url_hash: string
          user_id: string | null
          worker_job_id: string | null
        }
        Insert: {
          attempts?: number
          client_ip_hash?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          expires_at?: string | null
          guest_key?: string | null
          id?: string
          idempotency_key?: string | null
          max_attempts?: number
          media_title?: string | null
          media_type?: string | null
          metadata?: Json
          normalized_url: string
          output_filename?: string | null
          output_size?: number | null
          progress?: number
          requested_format: string
          requested_quality?: string | null
          source_platform?: string | null
          source_url: string
          started_at?: string | null
          status?: string
          temporary_storage_path?: string | null
          updated_at?: string
          url_hash: string
          user_id?: string | null
          worker_job_id?: string | null
        }
        Update: {
          attempts?: number
          client_ip_hash?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          expires_at?: string | null
          guest_key?: string | null
          id?: string
          idempotency_key?: string | null
          max_attempts?: number
          media_title?: string | null
          media_type?: string | null
          metadata?: Json
          normalized_url?: string
          output_filename?: string | null
          output_size?: number | null
          progress?: number
          requested_format?: string
          requested_quality?: string | null
          source_platform?: string | null
          source_url?: string
          started_at?: string | null
          status?: string
          temporary_storage_path?: string | null
          updated_at?: string
          url_hash?: string
          user_id?: string | null
          worker_job_id?: string | null
        }
        Relationships: []
      }
      downloader_settings: {
        Row: {
          accent_primary: string
          accent_secondary: string
          downloads_paused: boolean
          favicon_url: string | null
          file_lifetime_minutes: number
          footer_text: string | null
          guest_downloads_enabled: boolean
          guest_requests_per_hour: number
          id: number
          logo_url: string | null
          maintenance_mode: boolean
          max_concurrent_jobs_global: number
          max_concurrent_jobs_per_user: number
          max_file_size_mb: number
          meta_description: string
          meta_title: string
          metadata_cache_minutes: number
          metadata_requests_per_minute: number
          privacy_url: string | null
          require_account: boolean
          site_name: string
          support_email: string | null
          terms_url: string | null
          updated_at: string
          user_requests_per_hour: number
        }
        Insert: {
          accent_primary?: string
          accent_secondary?: string
          downloads_paused?: boolean
          favicon_url?: string | null
          file_lifetime_minutes?: number
          footer_text?: string | null
          guest_downloads_enabled?: boolean
          guest_requests_per_hour?: number
          id?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          max_concurrent_jobs_global?: number
          max_concurrent_jobs_per_user?: number
          max_file_size_mb?: number
          meta_description?: string
          meta_title?: string
          metadata_cache_minutes?: number
          metadata_requests_per_minute?: number
          privacy_url?: string | null
          require_account?: boolean
          site_name?: string
          support_email?: string | null
          terms_url?: string | null
          updated_at?: string
          user_requests_per_hour?: number
        }
        Update: {
          accent_primary?: string
          accent_secondary?: string
          downloads_paused?: boolean
          favicon_url?: string | null
          file_lifetime_minutes?: number
          footer_text?: string | null
          guest_downloads_enabled?: boolean
          guest_requests_per_hour?: number
          id?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          max_concurrent_jobs_global?: number
          max_concurrent_jobs_per_user?: number
          max_file_size_mb?: number
          meta_description?: string
          meta_title?: string
          metadata_cache_minutes?: number
          metadata_requests_per_minute?: number
          privacy_url?: string | null
          require_account?: boolean
          site_name?: string
          support_email?: string | null
          terms_url?: string | null
          updated_at?: string
          user_requests_per_hour?: number
        }
        Relationships: []
      }
      enquiries: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          service_slug: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          service_slug?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          service_slug?: string | null
          status?: string
        }
        Relationships: []
      }
      hosting_plans: {
        Row: {
          active: boolean
          bandwidth_gb: number
          category: string
          cpu_cores: number
          created_at: string
          currency: string
          description: string
          disk_gb: number
          features: Json
          id: string
          name: string
          popular: boolean
          price_monthly: number
          ram_mb: number
          slug: string
          sort_order: number
          tagline: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bandwidth_gb?: number
          category?: string
          cpu_cores?: number
          created_at?: string
          currency?: string
          description?: string
          disk_gb?: number
          features?: Json
          id?: string
          name: string
          popular?: boolean
          price_monthly?: number
          ram_mb?: number
          slug: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bandwidth_gb?: number
          category?: string
          cpu_cores?: number
          created_at?: string
          currency?: string
          description?: string
          disk_gb?: number
          features?: Json
          id?: string
          name?: string
          popular?: boolean
          price_monthly?: number
          ram_mb?: number
          slug?: string
          sort_order?: number
          tagline?: string
          updated_at?: string
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
      media_metadata_cache: {
        Row: {
          created_at: string
          expires_at: string
          normalized_url: string
          payload: Json
          platform: string | null
          url_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          normalized_url: string
          payload: Json
          platform?: string | null
          url_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          normalized_url?: string
          payload?: Json
          platform?: string | null
          url_hash?: string
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
      platforms: {
        Row: {
          created_at: string
          domain: string
          enabled: boolean
          extractor: string
          id: string
          last_checked: string | null
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          enabled?: boolean
          extractor?: string
          id?: string
          last_checked?: string | null
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          enabled?: boolean
          extractor?: string
          id?: string
          last_checked?: string | null
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          is_favorite: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          framework?: string
          id?: string
          is_favorite?: boolean
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          framework?: string
          id?: string
          is_favorite?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket_key: string
          count: number
          created_at: string
          id: string
          scope: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          created_at?: string
          id?: string
          scope: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          created_at?: string
          id?: string
          scope?: string
          window_start?: string
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
      worker_heartbeats: {
        Row: {
          active_jobs: number
          capabilities: Json
          cpu_percent: number | null
          id: string
          memory_percent: number | null
          queue_length: number
          reported_at: string
          version: string | null
          worker_id: string
        }
        Insert: {
          active_jobs?: number
          capabilities?: Json
          cpu_percent?: number | null
          id?: string
          memory_percent?: number | null
          queue_length?: number
          reported_at?: string
          version?: string | null
          worker_id: string
        }
        Update: {
          active_jobs?: number
          capabilities?: Json
          cpu_percent?: number | null
          id?: string
          memory_percent?: number | null
          queue_length?: number
          reported_at?: string
          version?: string | null
          worker_id?: string
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
      hit_rate_limit: {
        Args: { _bucket: string; _scope: string; _window_start: string }
        Returns: number
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
      app_role: ["administrator", "moderator", "premium", "standard"],
    },
  },
} as const
