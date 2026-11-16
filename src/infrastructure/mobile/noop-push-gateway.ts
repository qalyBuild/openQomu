import type {
  PushGateway,
  PushPermissionState,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'

/** Gateway inerte para web y modo demo. */
export class NoopPushGateway implements PushGateway {
  isSupported(): boolean {
    return false
  }

  async permission(): Promise<PushPermissionState> {
    return { status: 'unsupported' }
  }

  async requestPermission(): Promise<PushPermissionState> {
    return { status: 'unsupported' }
  }

  async initialize(): Promise<void> {}

  async register(): Promise<void> {}

  deviceId(): string {
    return 'web'
  }

  platform(): 'android' | 'ios' {
    return 'android'
  }

  async appVersion(): Promise<string | null> {
    return null
  }

  onToken(_callback: Subscriber<string>): Unsubscribe {
    return () => {}
  }

  onNotificationTap(_callback: Subscriber<string>): Unsubscribe {
    return () => {}
  }
}
