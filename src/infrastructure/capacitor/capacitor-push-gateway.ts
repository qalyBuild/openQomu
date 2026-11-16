import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
import type {
  PushGateway,
  PushPermissionState,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'

const DEVICE_ID_KEY = 'openqomu.push.deviceId'
// El sonido de un canal de Android no se puede cambiar después de crearlo:
// al modificarlo hay que estrenar id.
const CHANNEL_ID = 'openqomu-v2'
const CHANNEL_SOUND = 'openqomu_notification'

function mapPermission(state: string): PushPermissionState['status'] {
  if (state === 'granted') return 'granted'
  if (state === 'denied') return 'denied'
  return 'prompt'
}

function readDeviceId(): string {
  try {
    const current = localStorage.getItem(DEVICE_ID_KEY)
    if (current) return current
    const created = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, created)
    return created
  } catch {
    return 'android-device'
  }
}

/** Implementación Android sobre @capacitor/push-notifications. */
export class CapacitorPushGateway implements PushGateway {
  private initialized = false

  isSupported(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  }

  async permission(): Promise<PushPermissionState> {
    if (!this.isSupported()) return { status: 'unsupported' }
    const status = await PushNotifications.checkPermissions()
    return { status: mapPermission(status.receive) }
  }

  async requestPermission(): Promise<PushPermissionState> {
    if (!this.isSupported()) return { status: 'unsupported' }
    const status = await PushNotifications.requestPermissions()
    return { status: mapPermission(status.receive) }
  }

  async initialize(): Promise<void> {
    if (this.initialized || !this.isSupported()) return
    this.initialized = true
    await PushNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'openQomu',
      description: 'Mensajes, tareas y menciones',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: CHANNEL_SOUND,
    })
  }

  async register(): Promise<void> {
    if (!this.isSupported()) return
    await PushNotifications.register()
  }

  deviceId(): string {
    return readDeviceId()
  }

  platform(): 'android' | 'ios' {
    return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
  }

  async appVersion(): Promise<string | null> {
    try {
      const info = await App.getInfo()
      return info.version || null
    } catch {
      return null
    }
  }

  onToken(callback: Subscriber<string>): Unsubscribe {
    let disposed = false
    const registration = PushNotifications.addListener('registration', (token) => {
      if (!disposed) callback(token.value)
    })
    const errors = PushNotifications.addListener('registrationError', (error) => {
      console.warn('[openqomu] push registration', error)
    })
    return () => {
      disposed = true
      void registration.then((handle) => handle.remove())
      void errors.then((handle) => handle.remove())
    }
  }

  onNotificationTap(callback: Subscriber<string>): Unsubscribe {
    let disposed = false
    const handle = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      if (disposed) return
      const path = action.notification.data?.path
      if (typeof path === 'string' && path.startsWith('/')) callback(path)
    })
    return () => {
      disposed = true
      void handle.then((listener) => listener.remove())
    }
  }
}
