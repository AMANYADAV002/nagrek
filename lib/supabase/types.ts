export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          age_confirmed_at: string | null
          location_cell: string | null
          location_updated_at: string | null
          role: 'user' | 'admin'
          banned_at: string | null
          ban_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          age_confirmed_at?: string | null
          location_cell?: string | null
          location_updated_at?: string | null
          role?: 'user' | 'admin'
          banned_at?: string | null
          ban_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          age_confirmed_at?: string | null
          location_cell?: string | null
          location_updated_at?: string | null
          role?: 'user' | 'admin'
          banned_at?: string | null
          ban_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          user_id: string
          razorpay_subscription_id: string | null
          plan: string
          status: 'trial' | 'active' | 'halted' | 'cancelled' | 'expired'
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          razorpay_subscription_id?: string | null
          plan: string
          status: 'trial' | 'active' | 'halted' | 'cancelled' | 'expired'
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          razorpay_subscription_id?: string | null
          plan?: string
          status?: 'trial' | 'active' | 'halted' | 'cancelled' | 'expired'
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payment_events: {
        Row: {
          event_id: string
          type: string
          payload: Json
          received_at: string
        }
        Insert: {
          event_id: string
          type: string
          payload: Json
          received_at?: string
        }
        Update: {
          event_id?: string
          type?: string
          payload?: Json
          received_at?: string
        }
      }
      blocks: {
        Row: {
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: {
          blocker_id?: string
          blocked_id?: string
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          reporter_id: string
          reported_id: string | null
          match_id: string | null
          reason: string
          status: 'open' | 'reviewed' | 'actioned'
          created_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          reported_id?: string | null
          match_id?: string | null
          reason: string
          status?: 'open' | 'reviewed' | 'actioned'
          created_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          reported_id?: string | null
          match_id?: string | null
          reason?: string
          status?: 'open' | 'reviewed' | 'actioned'
          created_at?: string
        }
      }
      waitlist: {
        Row: { id: string; email: string; city: string | null; source: string | null; created_at: string }
        Insert: { id?: string; email: string; city?: string | null; source?: string | null; created_at?: string }
        Update: { id?: string; email?: string; city?: string | null; source?: string | null; created_at?: string }
      }
      matches: {
        Row: {
          id: string
          user_a: string | null
          user_b: string | null
          food: string | null
          region: string | null
          location_cell: string | null
          started_at: string
          ended_at: string | null
          outcome: string | null
          rating_a: number | null
          rating_b: number | null
        }
        Insert: {
          id: string
          user_a?: string | null
          user_b?: string | null
          food?: string | null
          region?: string | null
          location_cell?: string | null
          started_at?: string
          ended_at?: string | null
          outcome?: string | null
          rating_a?: number | null
          rating_b?: number | null
        }
        Update: {
          id?: string
          user_a?: string | null
          user_b?: string | null
          food?: string | null
          region?: string | null
          location_cell?: string | null
          started_at?: string
          ended_at?: string | null
          outcome?: string | null
          rating_a?: number | null
          rating_b?: number | null
        }
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          receiver_id: string
          status: 'pending' | 'accepted'
          created_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          receiver_id: string
          status?: 'pending' | 'accepted'
          created_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          receiver_id?: string
          status?: 'pending' | 'accepted'
          created_at?: string
        }
      }
      referrals: {
        Row: { id: string; referrer_id: string; referred_id: string; created_at: string }
        Insert: { id?: string; referrer_id: string; referred_id: string; created_at?: string }
        Update: { id?: string; referrer_id?: string; referred_id?: string; created_at?: string }
      }
      events: {
        Row: { id: string; user_id: string | null; name: string; props: Json; created_at: string }
        Insert: { id?: string; user_id?: string | null; name: string; props?: Json; created_at?: string }
        Update: { id?: string; user_id?: string | null; name?: string; props?: Json; created_at?: string }
      }
    }
  }
}
