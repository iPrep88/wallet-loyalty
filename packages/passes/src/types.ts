export type StampIcon =
  | 'circle' | 'boba' | 'cup' | 'bean' | 'bowl' | 'croissant' | 'scoop'
  | 'star' | 'heart' | 'custom'
export type CardState = 'collecting' | 'reward_ready'
export type CardStyle = 'minimal' | 'photo' | 'ai'

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
  /** Which ground the card sits on. */
  style?: CardStyle
  /** For style 'photo': the merchant's picture, already loaded. */
  photo?: Buffer
  /** 1, 2 or 3 for Apple's @Nx variants. */
  scale?: number
}
