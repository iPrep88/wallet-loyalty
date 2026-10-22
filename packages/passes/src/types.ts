export type StampIcon = 'cup' | 'boba' | 'bean' | 'star' | 'heart' | 'circle' | 'custom'
export type CardState = 'collecting' | 'reward_ready'
export type CardStyle = 'stamps' | 'minimal' | 'band' | 'progress'

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
  /** Which of the four looks to draw. */
  style?: CardStyle
  /**
   * For style 'band': the owner's own artwork, already loaded. Passed as
   * bytes rather than a URL because the renderer must never depend on
   * fetching something over the network mid-render.
   */
  bandImage?: Buffer
  /** 1, 2 or 3 for Apple's @Nx variants. */
  scale?: number
}
