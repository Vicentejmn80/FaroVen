export interface PushRegistrationResult {
  provider: string
  playerId: string
  deviceType?: string
}

export interface PushProvider {
  readonly name: string
  isAvailable(): boolean
  initialize(): Promise<void>
  requestPermissionAndSubscribe(userId: string): Promise<PushRegistrationResult | null>
  login(userId: string): Promise<void>
  /** Re-guarda en Supabase si el usuario ya tenía push activo en este dispositivo. */
  syncExistingSubscription(userId: string): Promise<PushRegistrationResult | null>
  logout(): Promise<void>
  onNotificationClick(handler: (actionUrl: string | null, data: Record<string, unknown>) => void): void
}
