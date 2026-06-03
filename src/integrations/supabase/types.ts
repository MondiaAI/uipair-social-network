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
      ambassador_applications: {
        Row: {
          created_at: string
          earnings_cents: number
          full_picture_url: string | null
          id: string
          motivation: string
          passport_photo_url: string | null
          referral_code: string
          referrals_count: number
          social_handles: string | null
          status: string
          student_id_card_url: string | null
          tenant_id: string
          university: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          earnings_cents?: number
          full_picture_url?: string | null
          id?: string
          motivation: string
          passport_photo_url?: string | null
          referral_code?: string
          referrals_count?: number
          social_handles?: string | null
          status?: string
          student_id_card_url?: string | null
          tenant_id?: string
          university: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          earnings_cents?: number
          full_picture_url?: string | null
          id?: string
          motivation?: string
          passport_photo_url?: string | null
          referral_code?: string
          referrals_count?: number
          social_handles?: string | null
          status?: string
          student_id_card_url?: string | null
          tenant_id?: string
          university?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bounties: {
        Row: {
          claimer_id: string | null
          created_at: string
          custom_subject: string | null
          deadline: string | null
          degree: string | null
          description: string | null
          id: string
          poster_id: string
          reward_cents: number
          status: Database["public"]["Enums"]["bounty_status"]
          subject: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          claimer_id?: string | null
          created_at?: string
          custom_subject?: string | null
          deadline?: string | null
          degree?: string | null
          description?: string | null
          id?: string
          poster_id: string
          reward_cents: number
          status?: Database["public"]["Enums"]["bounty_status"]
          subject: string
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          claimer_id?: string | null
          created_at?: string
          custom_subject?: string | null
          deadline?: string | null
          degree?: string | null
          description?: string | null
          id?: string
          poster_id?: string
          reward_cents?: number
          status?: Database["public"]["Enums"]["bounty_status"]
          subject?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_announcements: {
        Row: {
          circle_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          circle_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          tenant_id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_announcements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_invites: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          tenant_id: string
          token: string
          use_count: number
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          tenant_id?: string
          token?: string
          use_count?: number
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          tenant_id?: string
          token?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "circle_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          circle_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["circle_member_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          circle_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["circle_member_role"]
          tenant_id?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["circle_member_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_post_comments: {
        Row: {
          circle_id: string
          content: string
          created_at: string
          id: string
          post_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          circle_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "circle_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_post_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_posts: {
        Row: {
          circle_id: string
          content: string
          created_at: string
          id: string
          post_type: Database["public"]["Enums"]["circle_post_kind"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          circle_id: string
          content: string
          created_at?: string
          id?: string
          post_type?: Database["public"]["Enums"]["circle_post_kind"]
          tenant_id?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          content?: string
          created_at?: string
          id?: string
          post_type?: Database["public"]["Enums"]["circle_post_kind"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_posts_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_resources: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          resource_type: string
          tenant_id: string
          title: string
          url: string
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          resource_type?: string
          tenant_id?: string
          title: string
          url: string
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          resource_type?: string
          tenant_id?: string
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_resources_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_sessions: {
        Row: {
          circle_id: string
          created_at: string
          description: string | null
          id: string
          join_url: string | null
          scheduled_at: string
          tenant_id: string
          title: string
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          description?: string | null
          id?: string
          join_url?: string | null
          scheduled_at: string
          tenant_id?: string
          title: string
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          description?: string | null
          id?: string
          join_url?: string | null
          scheduled_at?: string
          tenant_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_sessions_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          circle_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          circle_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          circle_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          cover_color: string | null
          created_at: string
          custom_subject: string | null
          degree: string | null
          description: string | null
          id: string
          is_premium: boolean
          kind: string
          leader_id: string
          meeting_schedule: string | null
          member_count: number
          name: string
          price_monthly: number | null
          resources_folder_url: string | null
          scope: Database["public"]["Enums"]["circle_scope"]
          subject: string
          tenant_id: string
          university: string | null
          updated_at: string
        }
        Insert: {
          cover_color?: string | null
          created_at?: string
          custom_subject?: string | null
          degree?: string | null
          description?: string | null
          id?: string
          is_premium?: boolean
          kind?: string
          leader_id: string
          meeting_schedule?: string | null
          member_count?: number
          name: string
          price_monthly?: number | null
          resources_folder_url?: string | null
          scope?: Database["public"]["Enums"]["circle_scope"]
          subject: string
          tenant_id?: string
          university?: string | null
          updated_at?: string
        }
        Update: {
          cover_color?: string | null
          created_at?: string
          custom_subject?: string | null
          degree?: string | null
          description?: string | null
          id?: string
          is_premium?: boolean
          kind?: string
          leader_id?: string
          meeting_schedule?: string | null
          member_count?: number
          name?: string
          price_monthly?: number | null
          resources_folder_url?: string | null
          scope?: Database["public"]["Enums"]["circle_scope"]
          subject?: string
          tenant_id?: string
          university?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_mutes: {
        Row: {
          conversation_id: string
          created_at: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_mutes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          tenant_id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          tenant_id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          tenant_id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crash_reports: {
        Row: {
          component_stack: string | null
          context: Json
          created_at: string
          error_name: string | null
          id: string
          label: string
          message: string
          route: string | null
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_stack?: string | null
          context?: Json
          created_at?: string
          error_name?: string | null
          id?: string
          label: string
          message: string
          route?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_stack?: string | null
          context?: Json
          created_at?: string
          error_name?: string | null
          id?: string
          label?: string
          message?: string
          route?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_orders: {
        Row: {
          amount_cents: number
          buyer_id: string
          created_at: string
          gig_id: string
          id: string
          notes: string | null
          seller_id: string
          status: Database["public"]["Enums"]["gig_order_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          buyer_id: string
          created_at?: string
          gig_id: string
          id?: string
          notes?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["gig_order_status"]
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          buyer_id?: string
          created_at?: string
          gig_id?: string
          id?: string
          notes?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["gig_order_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_reviews: {
        Row: {
          comment: string | null
          created_at: string
          gig_id: string
          id: string
          order_id: string
          rating: number
          reviewer_id: string
          seller_id: string
          tenant_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          gig_id: string
          id?: string
          order_id: string
          rating: number
          reviewer_id: string
          seller_id: string
          tenant_id?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          gig_id?: string
          id?: string
          order_id?: string
          rating?: number
          reviewer_id?: string
          seller_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gigs: {
        Row: {
          category: Database["public"]["Enums"]["gig_category"]
          created_at: string
          custom_category: string | null
          degree: string | null
          delivery_days: number
          description: string | null
          id: string
          included_items: string[]
          is_active: boolean
          order_count: number
          price_cents: number
          rating_avg: number
          requires_file_upload: boolean
          review_count: number
          seller_id: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["gig_category"]
          created_at?: string
          custom_category?: string | null
          degree?: string | null
          delivery_days?: number
          description?: string | null
          id?: string
          included_items?: string[]
          is_active?: boolean
          order_count?: number
          price_cents: number
          rating_avg?: number
          requires_file_upload?: boolean
          review_count?: number
          seller_id: string
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["gig_category"]
          created_at?: string
          custom_category?: string | null
          degree?: string | null
          delivery_days?: number
          description?: string | null
          id?: string
          included_items?: string[]
          is_active?: boolean
          order_count?: number
          price_cents?: number
          rating_avg?: number
          requires_file_upload?: boolean
          review_count?: number
          seller_id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gigs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathon_banners: {
        Row: {
          created_at: string
          deadline: string | null
          display_order: number
          id: string
          is_active: boolean
          prize_amount: string | null
          register_url: string
          sponsor_logo_url: string | null
          sponsor_name: string
          tenant_id: string
          title: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          prize_amount?: string | null
          register_url: string
          sponsor_logo_url?: string | null
          sponsor_name: string
          tenant_id?: string
          title: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          prize_amount?: string | null
          register_url?: string
          sponsor_logo_url?: string | null
          sponsor_name?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_banners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      match_dismissals: {
        Row: {
          created_at: string
          dismissed_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_dismissals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachment_views: {
        Row: {
          line_index: number
          message_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          line_index: number
          message_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          line_index?: number
          message_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachment_views_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          tenant_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          tenant_id?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          tenant_id?: string
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
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          related_id: string | null
          tenant_id: string
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_id?: string | null
          tenant_id?: string
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_id?: string | null
          tenant_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_matches: {
        Row: {
          availability_overlap: string[]
          created_at: string
          id: string
          match_reason: string | null
          match_score: number
          matched_user_id: string
          shared_skills: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_overlap?: string[]
          created_at?: string
          id?: string
          match_reason?: string | null
          match_score: number
          matched_user_id: string
          shared_skills?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_overlap?: string[]
          created_at?: string
          id?: string
          match_reason?: string | null
          match_score?: number
          matched_user_id?: string
          shared_skills?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          content: string
          created_at: string
          degree: string | null
          id: string
          is_live_session: boolean
          media_url: string | null
          post_type: Database["public"]["Enums"]["post_type"]
          tag_color: string | null
          tenant_id: string
          university: string | null
          user_id: string
          view_count: number
        }
        Insert: {
          content: string
          created_at?: string
          degree?: string | null
          id?: string
          is_live_session?: boolean
          media_url?: string | null
          post_type?: Database["public"]["Enums"]["post_type"]
          tag_color?: string | null
          tenant_id?: string
          university?: string | null
          user_id: string
          view_count?: number
        }
        Update: {
          content?: string
          created_at?: string
          degree?: string | null
          id?: string
          is_live_session?: boolean
          media_url?: string | null
          post_type?: Database["public"]["Enums"]["post_type"]
          tag_color?: string | null
          tenant_id?: string
          university?: string | null
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability: string[]
          avatar_url: string | null
          bio: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          date_of_birth: string | null
          field_of_study: string | null
          full_name: string | null
          goals: string | null
          id: string
          interests: string[]
          is_pro: boolean
          is_verified: boolean
          last_seen_at: string
          onboarding_completed: boolean
          public_key: string | null
          reputation_score: number
          skills: string[]
          stripe_account_id: string | null
          tenant_id: string | null
          terms_accepted_at: string | null
          university: string | null
          university_id: string | null
          updated_at: string
          username: string | null
          year_of_study: number | null
        }
        Insert: {
          availability?: string[]
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          field_of_study?: string | null
          full_name?: string | null
          goals?: string | null
          id: string
          interests?: string[]
          is_pro?: boolean
          is_verified?: boolean
          last_seen_at?: string
          onboarding_completed?: boolean
          public_key?: string | null
          reputation_score?: number
          skills?: string[]
          stripe_account_id?: string | null
          tenant_id?: string | null
          terms_accepted_at?: string | null
          university?: string | null
          university_id?: string | null
          updated_at?: string
          username?: string | null
          year_of_study?: number | null
        }
        Update: {
          availability?: string[]
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          field_of_study?: string | null
          full_name?: string | null
          goals?: string | null
          id?: string
          interests?: string[]
          is_pro?: boolean
          is_verified?: boolean
          last_seen_at?: string
          onboarding_completed?: boolean
          public_key?: string | null
          reputation_score?: number
          skills?: string[]
          stripe_account_id?: string | null
          tenant_id?: string | null
          terms_accepted_at?: string | null
          university?: string | null
          university_id?: string | null
          updated_at?: string
          username?: string | null
          year_of_study?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      project_activity: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_applications: {
        Row: {
          applicant_id: string
          created_at: string
          desired_role: Database["public"]["Enums"]["project_role"]
          id: string
          message: string | null
          project_id: string
          status: Database["public"]["Enums"]["project_application_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          desired_role?: Database["public"]["Enums"]["project_role"]
          id?: string
          message?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["project_application_status"]
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          desired_role?: Database["public"]["Enums"]["project_role"]
          id?: string
          message?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["project_application_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          project_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          project_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          project_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          created_at: string
          file_type: string
          id: string
          project_id: string
          tenant_id: string
          title: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_type?: string
          id?: string
          project_id: string
          tenant_id?: string
          title: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_type?: string
          id?: string
          project_id?: string
          tenant_id?: string
          title?: string
          url?: string
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
          {
            foreignKeyName: "project_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_join_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          project_id: string
          status: Database["public"]["Enums"]["project_join_request_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["project_join_request_status"]
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["project_join_request_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_join_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          id: string
          joined_at: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          tenant_id?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string | null
          id: string
          position: number
          project_id: string
          status: Database["public"]["Enums"]["project_task_status"]
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          project_id: string
          status?: Database["public"]["Enums"]["project_task_status"]
          tenant_id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          project_id?: string
          status?: Database["public"]["Enums"]["project_task_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_workspaces: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          status: Database["public"]["Enums"]["workspace_status"]
          tenant_id: string
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          project_id: string
          status?: Database["public"]["Enums"]["workspace_status"]
          tenant_id?: string
          type?: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["workspace_status"]
          tenant_id?: string
          type?: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_workspaces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workspaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category: Database["public"]["Enums"]["project_category"]
          cover_color: string | null
          created_at: string
          creator_id: string
          custom_category: string | null
          custom_roles: string | null
          deadline: string | null
          degree: string | null
          description: string | null
          fee_interval: string
          id: string
          is_public: boolean
          join_fee_cents: number
          member_count: number
          name: string
          open_roles: Database["public"]["Enums"]["project_role"][]
          progress: number
          subject: string
          team_size_limit: number
          tenant_id: string
          updated_at: string
          view_count: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["project_category"]
          cover_color?: string | null
          created_at?: string
          creator_id: string
          custom_category?: string | null
          custom_roles?: string | null
          deadline?: string | null
          degree?: string | null
          description?: string | null
          fee_interval?: string
          id?: string
          is_public?: boolean
          join_fee_cents?: number
          member_count?: number
          name: string
          open_roles?: Database["public"]["Enums"]["project_role"][]
          progress?: number
          subject: string
          team_size_limit?: number
          tenant_id?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["project_category"]
          cover_color?: string | null
          created_at?: string
          creator_id?: string
          custom_category?: string | null
          custom_roles?: string | null
          deadline?: string | null
          degree?: string | null
          description?: string | null
          fee_interval?: string
          id?: string
          is_public?: boolean
          join_fee_cents?: number
          member_count?: number
          name?: string
          open_roles?: Database["public"]["Enums"]["project_role"][]
          progress?: number
          subject?: string
          team_size_limit?: number
          tenant_id?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: Database["public"]["Enums"]["reaction_type"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_purchases: {
        Row: {
          amount_cents: number
          buyer_id: string
          created_at: string
          id: string
          resource_id: string
          seller_id: string
          tenant_id: string
        }
        Insert: {
          amount_cents: number
          buyer_id: string
          created_at?: string
          id?: string
          resource_id: string
          seller_id: string
          tenant_id?: string
        }
        Update: {
          amount_cents?: number
          buyer_id?: string
          created_at?: string
          id?: string
          resource_id?: string
          seller_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          description: string | null
          download_count: number
          file_url: string | null
          id: string
          is_active: boolean
          preview_url: string | null
          price_cents: number
          subject: string
          tenant_id: string
          title: string
          updated_at: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          download_count?: number
          file_url?: string | null
          id?: string
          is_active?: boolean
          preview_url?: string | null
          price_cents?: number
          subject: string
          tenant_id?: string
          title: string
          updated_at?: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          download_count?: number
          file_url?: string | null
          id?: string
          is_active?: boolean
          preview_url?: string | null
          price_cents?: number
          subject?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      study_requests: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          join_url: string | null
          message: string | null
          proposed_at: string
          recipient_id: string
          sender_id: string
          status: Database["public"]["Enums"]["study_request_status"]
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          join_url?: string | null
          message?: string | null
          proposed_at: string
          recipient_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["study_request_status"]
          subject: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          join_url?: string | null
          message?: string | null
          proposed_at?: string
          recipient_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["study_request_status"]
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_admins: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_admin_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_admin_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_admin_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_admins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_join_requests: {
        Row: {
          created_at: string
          id: string
          note: string | null
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_join_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          country: string | null
          created_at: string
          email_domain: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email_domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email_domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      universities: {
        Row: {
          country: string
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_project_join_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      current_tenant_id: { Args: never; Returns: string }
      decline_project_join_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      has_active_circle_subscription: {
        Args: { _circle_id: string; _environment?: string; _user_id: string }
        Returns: boolean
      }
      increment_project_view: {
        Args: { _project_id: string }
        Returns: undefined
      }
      is_circle_member: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_creator: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant: string; _user: string }
        Returns: boolean
      }
      join_public_project: { Args: { _project_id: string }; Returns: string }
      normalize_location: { Args: { input: string }; Returns: string }
      redeem_circle_invite: { Args: { _token: string }; Returns: string }
      request_project_join: {
        Args: { _project_id: string }
        Returns: undefined
      }
    }
    Enums: {
      bounty_status: "open" | "claimed" | "completed" | "cancelled"
      circle_member_role: "leader" | "moderator" | "member"
      circle_post_kind:
        | "discussion"
        | "research"
        | "partner"
        | "question"
        | "resource"
      circle_scope: "campus" | "global"
      friend_request_status: "pending" | "accepted" | "declined" | "canceled"
      gig_category:
        | "tutoring"
        | "notes"
        | "research"
        | "coding"
        | "design"
        | "translation"
        | "proofreading"
        | "other"
        | "writing"
        | "video_editing"
        | "data_analysis"
        | "presentations"
        | "language_practice"
        | "music"
        | "photography"
        | "marketing"
      gig_order_status:
        | "pending"
        | "in_progress"
        | "delivered"
        | "completed"
        | "cancelled"
        | "refunded"
      post_type: "research" | "partner" | "brainstorm" | "question" | "resource"
      project_application_status: "pending" | "accepted" | "declined"
      project_category:
        | "hackathon"
        | "research"
        | "startup"
        | "course"
        | "other"
        | "open_source"
        | "thesis"
        | "competition"
        | "club"
        | "nonprofit"
      project_join_request_status: "pending" | "approved" | "declined"
      project_role:
        | "creator"
        | "designer"
        | "coder"
        | "researcher"
        | "writer"
        | "other"
      project_task_status: "todo" | "in_progress" | "done"
      reaction_type: "lightbulb" | "fire" | "brain" | "bookmark" | "agree"
      study_request_status: "pending" | "accepted" | "declined" | "cancelled"
      tenant_admin_role: "owner" | "admin" | "moderator"
      workspace_status: "active" | "draft" | "complete"
      workspace_type: "document" | "board" | "mindmap" | "thread"
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
      bounty_status: ["open", "claimed", "completed", "cancelled"],
      circle_member_role: ["leader", "moderator", "member"],
      circle_post_kind: [
        "discussion",
        "research",
        "partner",
        "question",
        "resource",
      ],
      circle_scope: ["campus", "global"],
      friend_request_status: ["pending", "accepted", "declined", "canceled"],
      gig_category: [
        "tutoring",
        "notes",
        "research",
        "coding",
        "design",
        "translation",
        "proofreading",
        "other",
        "writing",
        "video_editing",
        "data_analysis",
        "presentations",
        "language_practice",
        "music",
        "photography",
        "marketing",
      ],
      gig_order_status: [
        "pending",
        "in_progress",
        "delivered",
        "completed",
        "cancelled",
        "refunded",
      ],
      post_type: ["research", "partner", "brainstorm", "question", "resource"],
      project_application_status: ["pending", "accepted", "declined"],
      project_category: [
        "hackathon",
        "research",
        "startup",
        "course",
        "other",
        "open_source",
        "thesis",
        "competition",
        "club",
        "nonprofit",
      ],
      project_join_request_status: ["pending", "approved", "declined"],
      project_role: [
        "creator",
        "designer",
        "coder",
        "researcher",
        "writer",
        "other",
      ],
      project_task_status: ["todo", "in_progress", "done"],
      reaction_type: ["lightbulb", "fire", "brain", "bookmark", "agree"],
      study_request_status: ["pending", "accepted", "declined", "cancelled"],
      tenant_admin_role: ["owner", "admin", "moderator"],
      workspace_status: ["active", "draft", "complete"],
      workspace_type: ["document", "board", "mindmap", "thread"],
    },
  },
} as const
