/** Piper length_scale is inverse of perceived speed (higher = slower). */
export function toDisplaySpeed(lengthScale: number): number {
  return 1 / lengthScale
}

export function fromDisplaySpeed(displaySpeed: number): number {
  return 1 / displaySpeed
}

export const SPEED_MIN = 0.5
export const SPEED_MAX = 2.0
