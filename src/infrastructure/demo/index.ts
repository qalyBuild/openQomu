import type { AppContainer } from '@/domain/ports'
import { DemoAuthRepository } from './demo-auth-repository'
import { DemoUserRepository } from './demo-user-repository'
import { DemoWorkspaceRepository } from './demo-workspace-repository'
import { DemoChannelRepository } from './demo-channel-repository'
import { DemoMessageRepository } from './demo-message-repository'
import { DemoBoardRepository } from './demo-board-repository'
import { DemoTaskRepository } from './demo-task-repository'
import { DemoPageRepository } from './demo-page-repository'
import { DemoFileReadRepository } from './demo-file-read-repository'
import { DemoFileRepository } from './demo-file-repository'
import { DemoFileFolderRepository } from './demo-file-folder-repository'
import { DemoMcpTokenRepository } from './demo-mcp-token-repository'
import { DemoDeviceRepository } from './demo-device-repository'
import { DemoPushOutbox } from './demo-push-outbox'
import { NoopPushGateway } from '@/infrastructure/mobile/noop-push-gateway'
import { getDemoStore, type DemoStore } from './store'

export function createDemoContainer(store: DemoStore = getDemoStore()): AppContainer {
  return {
    mode: 'demo',
    auth: new DemoAuthRepository(store),
    users: new DemoUserRepository(store),
    workspaces: new DemoWorkspaceRepository(store),
    channels: new DemoChannelRepository(store),
    messages: new DemoMessageRepository(store),
    boards: new DemoBoardRepository(store),
    tasks: new DemoTaskRepository(store),
    pages: new DemoPageRepository(store),
    files: new DemoFileRepository(store),
    fileReads: new DemoFileReadRepository(store),
    fileFolders: new DemoFileFolderRepository(store),
    mcpTokens: new DemoMcpTokenRepository(),
    devices: new DemoDeviceRepository(),
    pushOutbox: new DemoPushOutbox(),
    pushGateway: new NoopPushGateway(),
    resetDemo: async () => {
      store.reset()
    },
  }
}

export { getDemoStore, DemoStore } from './store'
