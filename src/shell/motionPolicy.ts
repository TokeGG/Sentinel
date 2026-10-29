// The one rule for whether the star map may run an animation loop.
export type MotionInputs = { visible: boolean; gameMode: boolean; reducedMotion: boolean; motionOn: boolean };

export function shouldAnimate(i: MotionInputs): boolean {
  return i.visible && !i.gameMode && !i.reducedMotion && i.motionOn;
}
