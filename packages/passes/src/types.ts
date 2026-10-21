export type StampIcon = 'cup' | 'boba' | 'bean' | 'star' | 'heart' | 'circle' | 'custom'
export type CardState = 'collecting' | 'reward_ready'

export interface StripRequest {
  stamps: number
  stampsRequired: number
  state: CardState
  icon: StampIcon
  bgColor: string
  fgColor: string
  labelColor: string
  rewardText: string
  /** Pixel dimensions at 1x. Apple's strip and Google's hero differ. */
  width: number
  height: number
  /** 1, 2 or 3 for Apple's @Nx variants. */
  scale?: number
}
