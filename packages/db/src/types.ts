export type SubscriptionStatus =
  | 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'

export type StampIcon = 'cup' | 'boba' | 'bean' | 'star' | 'heart' | 'circle' | 'custom'

export type EventType = 'join' | 'stamp' | 'redeem' | 'adjust' | 'undo'

export type JobKind = 'push_member' | 'push_program' | 'google_patch' | 'strip_warm'

export interface Business {
  id: string
  owner_user_id: string | null
  name: string
  slug: string
  timezone: string
  stripe_customer_id: string | null
  subscription_status: SubscriptionStatus
  trial_ends_at: Date | null
  created_at: Date
}

export interface Program {
  id: string
  business_id: string
  stamps_required: number
  reward_text: string
  join_bonus: number
  cooldown_seconds: number
  logo_url: string | null
  icon_url: string | null
  stamp_icon: StampIcon
  stamp_icon_url: string | null
  bg_color: string
  fg_color: string
  label_color: string
  back_address: string | null
  back_hours: string | null
  back_instagram: string | null
  back_menu_url: string | null
  back_terms: string
  design_version: number
  google_class_id: string | null
  created_at: Date
  updated_at: Date
}

export interface Member {
  id: string
  program_id: string
  serial: string
  auth_token: string
  phone: string | null
  first_name: string | null
  sms_consent_at: Date | null
  stamps: number
  rewards_earned: number
  total_visits: number
  last_visit_at: Date | null
  last_staff_stamp_at: Date | null
  platform: 'apple' | 'google' | null
  google_object_id: string | null
  created_at: Date
  updated_at: Date
}

export interface Staff {
  id: string
  business_id: string
  name: string
  pin_hash: string
  active: boolean
  created_at: Date
}

export interface StampEvent {
  id: string
  member_id: string
  staff_id: string | null
  type: EventType
  quantity: number
  client_event_id: string
  undoes_event_id: string | null
  created_at: Date
}
