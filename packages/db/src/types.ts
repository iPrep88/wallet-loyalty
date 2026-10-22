export type SubscriptionStatus =
  | 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'

/** Four looks, one renderer. */
export type CardStyle = 'minimal' | 'photo' | 'ai'

export type EventType = 'join' | 'stamp' | 'redeem' | 'adjust' | 'undo'

export type JobKind =
  | 'push_member' | 'push_program' | 'google_patch' | 'strip_warm'
  | 'weekly_digest' | 'quiet_store_check'

export type Audience = 'all' | 'one_away' | 'lapsed' | 'reward_ready'

export interface User {
  id: string
  email: string
  password_hash: string
  name: string | null
  created_at: Date
  last_login_at: Date | null
}

/** The brand. Owns the card design and the subscription. */
export interface Company {
  id: string
  owner_user_id: string
  name: string
  slug: string
  timezone: string
  stripe_customer_id: string | null
  subscription_status: SubscriptionStatus
  trial_ends_at: Date | null
  created_at: Date
}

/** A location. Its own stamp pool, counter QR, and staff. */
export interface Store {
  id: string
  company_id: string
  name: string
  slug: string
  address: string | null
  /** Goes into the pass so the card wakes on a lock screen near the shop. */
  latitude: number | null
  longitude: number | null
  active: boolean
  created_at: Date
}

/** The card: how it looks, what it takes, what it gives. */
export interface Program {
  id: string
  company_id: string
  stamps_required: number
  reward_text: string
  reward_value_cents: number | null
  join_bonus: number
  cooldown_seconds: number
  card_style: CardStyle
  logo_url: string | null
  icon_url: string | null
  photo_url: string | null
  stamp_icon: string
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
  store_id: string
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
  store_id: string
  name: string
  pin_hash: string
  active: boolean
  created_at: Date
}

export interface StampEvent {
  id: string
  member_id: string
  store_id: string
  staff_id: string | null
  type: EventType
  quantity: number
  reward_value_cents: number | null
  client_event_id: string
  undoes_event_id: string | null
  created_at: Date
}
