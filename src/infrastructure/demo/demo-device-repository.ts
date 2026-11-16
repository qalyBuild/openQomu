import type { DeviceRepository } from '@/domain/ports'
import type { PushDevice, RegisterDeviceInput } from '@/domain/entities/push'
import { createDeviceRegistration, normalizeAppVersion } from '@/domain/services/push-service'
import { NotFoundError } from '@/domain/errors'

/** Adaptador en memoria con el mismo contrato que Firebase. */
export class DemoDeviceRepository implements DeviceRepository {
  private devices: PushDevice[] = []

  async register(uid: string, input: RegisterDeviceInput): Promise<PushDevice> {
    const normalized = createDeviceRegistration(input)
    const existing = this.devices.find(
      (device) => device.uid === uid && device.id === normalized.id,
    )
    const now = new Date().toISOString()
    const device: PushDevice = {
      id: normalized.id,
      uid,
      token: normalized.token,
      platform: normalized.platform,
      appVersion: normalizeAppVersion(normalized.appVersion),
      enabled: existing?.enabled ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    this.devices = [
      ...this.devices.filter((item) => !(item.uid === uid && item.id === normalized.id)),
      device,
    ]
    return device
  }

  async remove(uid: string, deviceId: string): Promise<void> {
    this.devices = this.devices.filter(
      (device) => !(device.uid === uid && device.id === deviceId),
    )
  }

  async setEnabled(uid: string, deviceId: string, enabled: boolean): Promise<void> {
    const device = await this.get(uid, deviceId)
    if (!device) throw new NotFoundError('El dispositivo no existe.')
    this.devices = this.devices.map((item) =>
      item.uid === uid && item.id === deviceId
        ? { ...item, enabled, updatedAt: new Date().toISOString() }
        : item,
    )
  }

  async get(uid: string, deviceId: string): Promise<PushDevice | null> {
    return this.devices.find((device) => device.uid === uid && device.id === deviceId) ?? null
  }

  async list(uid: string): Promise<PushDevice[]> {
    return this.devices.filter((device) => device.uid === uid)
  }
}
