/** A member number as typed: a positive integer without leading zeros, up to the backend's 999999. */
export function isMemberNumber(value: string) {
  return /^[1-9]\d{0,5}$/.test(value)
}
