import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import type { DeviceRepository } from '@/domain/ports'
import type { DevicePlatform, PushDevice, RegisterDeviceInput } from '@/domain/entities/push'
import { createDeviceRegistration, normalizeAppVersion } from '@/domain/services/push-service'
import { NotFoundError } from '@/domain/errors'
import { getFirebaseDb } from './client'
import { nowIso } from './firestore-utils'

function devicesCol(uid: string) {
  return collection(getFirebaseDb(), 'users', uid, 'devices')
}

function deviceRef(uid: string, deviceId: string) {
  return doc(getFirebaseDb(), 'users', uid, 'devices', deviceId)
}

function mapDevice(uid: string, id: string, data: Record<string, unknown>): PushDevice {
  return {
    id,
    uid,
    token: typeof data.token === 'string' ? data.token : '',
    platform: (data.platform === 'ios' ? 'ios' : 'android') as DevicePlatform,
    appVersion: typeof data.appVersion === 'string' ? data.appVersion : null,
    enabled: data.enabled !== false,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : nowIso(),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
  }
}

export class FirebaseDeviceRepository implements DeviceRepository {
  async register(uid: string, input: RegisterDeviceInput): Promise<PushDevice> {
    const normalized = createDeviceRegistration(input)
    const reference = deviceRef(uid, normalized.id)
    const current = await getDoc(reference)
    const now = nowIso()
    const enabled = current.exists() ? current.data().enabled !== false : true
    const createdAt =
      current.exists() && typeof current.data().createdAt === 'string'
        ? (current.data().createdAt as string)
        : now
    const device: PushDevice = {
      id: normalized.id,
      uid,
      token: normalized.token,
      platform: normalized.platform,
      appVersion: normalizeAppVersion(normalized.appVersion),
      enabled,
      createdAt,
      updatedAt: now,
    }
    await setDoc(reference, {
      token: device.token,
      platform: device.platform,
      appVersion: device.appVersion,
      enabled: device.enabled,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    })
    return device
  }

  async remove(uid: string, deviceId: string): Promise<void> {
    await deleteDoc(deviceRef(uid, deviceId))
  }

  async setEnabled(uid: string, deviceId: string, enabled: boolean): Promise<void> {
    const reference = deviceRef(uid, deviceId)
    const current = await getDoc(reference)
    if (!current.exists()) throw new NotFoundError('El dispositivo no existe.')
    await updateDoc(reference, { enabled, updatedAt: nowIso() })
  }

  async get(uid: string, deviceId: string): Promise<PushDevice | null> {
    const snapshot = await getDoc(deviceRef(uid, deviceId))
    return snapshot.exists() ? mapDevice(uid, snapshot.id, snapshot.data()) : null
  }

  async list(uid: string): Promise<PushDevice[]> {
    const snapshot = await getDocs(devicesCol(uid))
    return snapshot.docs.map((document) => mapDevice(uid, document.id, document.data()))
  }
}
