import type { AppContainer } from '@/domain/ports'
import { connectFirebaseEmulators } from './client'
import { FirebaseAuthRepository } from './firebase-auth-repository'
import { FirebaseUserRepository } from './firebase-user-repository'
import { FirebaseWorkspaceRepository } from './firebase-workspace-repository'
import { FirebaseChannelRepository } from './firebase-channel-repository'
import { FirebaseMessageRepository } from './firebase-message-repository'
import { FirebaseBoardRepository } from './firebase-board-repository'
import { FirebaseTaskRepository } from './firebase-task-repository'
import { FirebasePageRepository } from './firebase-page-repository'
import { FirebaseFileRepository } from './firebase-file-repository'
import { S3FileRepository } from './s3-file-repository'
import { FirebaseFileFolderRepository } from './firebase-file-folder-repository'
import { FirestoreFreeFileRepository } from './firestore-free-file-repository'
import { FirebaseMcpTokenRepository } from './firebase-mcp-token-repository'
import { FirebaseDeviceRepository } from './firebase-device-repository'
import { FirebasePushOutbox } from './firebase-push-outbox'
import { NoopPushGateway } from '@/infrastructure/mobile/noop-push-gateway'
import {
  PushAwareMessageRepository,
  PushAwareTaskRepository,
} from '@/infrastructure/push/push-aware-repositories'

export async function createFirebaseContainer(): Promise<AppContainer> {
  connectFirebaseEmulators()
  // Capacitor solo se descarga en la app nativa; la web no paga ese peso.
  const { Capacitor } = await import('@capacitor/core')
  const native = Capacitor.isNativePlatform()
  const pushOutbox = new FirebasePushOutbox()
  const auth = new FirebaseAuthRepository(
    native
      ? new (await import('@/infrastructure/capacitor/capacitor-google-sign-in'))
          .CapacitorGoogleSignIn()
      : undefined,
  )
  const pushGateway = native
    ? new (await import('@/infrastructure/capacitor/capacitor-push-gateway'))
        .CapacitorPushGateway()
    : new NoopPushGateway()
  return {
    mode: 'firebase',
    auth,
    users: new FirebaseUserRepository(),
    workspaces: new FirebaseWorkspaceRepository(),
    channels: new FirebaseChannelRepository(),
    messages: new PushAwareMessageRepository(new FirebaseMessageRepository(), pushOutbox),
    boards: new FirebaseBoardRepository(),
    tasks: new PushAwareTaskRepository(
      new FirebaseTaskRepository(),
      pushOutbox,
      () => auth.getCurrentUser()?.id ?? null,
    ),
    pages: new FirebasePageRepository(),
    files:
      import.meta.env.VITE_FILE_STORAGE === 'storage'
        ? new FirebaseFileRepository()
        : import.meta.env.VITE_FILE_STORAGE === 's3'
          ? new S3FileRepository()
          : new FirestoreFreeFileRepository(),
    fileFolders: new FirebaseFileFolderRepository(),
    mcpTokens: new FirebaseMcpTokenRepository(),
    devices: new FirebaseDeviceRepository(),
    pushOutbox,
    pushGateway,
  }
}
