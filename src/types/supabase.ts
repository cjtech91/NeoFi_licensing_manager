export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'operator'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          role?: 'admin' | 'operator'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'operator'
          created_at?: string
          updated_at?: string
        }
      }
      machines: {
        Row: {
          id: string
          name: string
          location: string | null
          status: 'online' | 'offline' | 'error'
          last_seen: string | null
          owner_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          location?: string | null
          status?: 'online' | 'offline' | 'error'
          last_seen?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          location?: string | null
          status?: 'online' | 'offline' | 'error'
          last_seen?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      vouchers: {
        Row: {
          id: string
          code: string
          denomination: 1 | 5 | 10
          status: 'active' | 'used' | 'expired'
          machine_id: string | null
          created_by: string | null
          used_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          denomination: 1 | 5 | 10
          status?: 'active' | 'used' | 'expired'
          machine_id?: string | null
          created_by?: string | null
          used_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          denomination?: 1 | 5 | 10
          status?: 'active' | 'used' | 'expired'
          machine_id?: string | null
          created_by?: string | null
          used_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          voucher_id: string | null
          amount: number
          sale_time: string
          machine_id: string | null
        }
        Insert: {
          id?: string
          voucher_id?: string | null
          amount: number
          sale_time?: string
          machine_id?: string | null
        }
        Update: {
          id?: string
          voucher_id?: string | null
          amount?: number
          sale_time?: string
          machine_id?: string | null
        }
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
