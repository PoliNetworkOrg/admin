export type Passkey = {
  id: string
  name?: string | null
  createdAt?: Date | string
  deviceType?: string
}

export type ActiveSession = {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt?: Date | string
}
