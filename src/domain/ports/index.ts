import type {
  Board,
  BoardColumn,
  Task,
  TaskComment,
  TaskDraftInput,
} from '@/domain/entities/kanban'
import type { Channel, FileFolder, FileMeta, Message, TypingUser } from '@/domain/entities/chat'
import type {
  Invite,
  Member,
  Role,
  User,
  Workspace,
} from '@/domain/entities/identity'
import type { Page, PageDraftInput } from '@/domain/entities/pages'
import type { McpToken, McpTokenDraft } from '@/domain/entities/ai'
import type {
  PushDevice,
  PushEvent,
  RegisterDeviceInput,
} from '@/domain/entities/push'

export type Unsubscribe = () => void
export type Subscriber<T> = (value: T) => void

export interface SessionUser {
  id: string
  displayName: string
  email: string
  photoURL: string | null
}

export interface AuthPort {
  onAuthStateChanged(callback: Subscriber<SessionUser | null>): Unsubscribe
  getCurrentUser(): SessionUser | null
  signInWithGoogle(): Promise<SessionUser>
  signOut(): Promise<void>
  isDemo(): boolean
}

export interface UserRepository {
  getProfile(uid: string): Promise<User | null>
  ensureProfile(user: SessionUser): Promise<User>
  updateProfile(uid: string, patch: Partial<Pick<User, 'displayName'>>): Promise<void>
  touch(uid: string): Promise<void>
  subscribeProfile(uid: string, callback: Subscriber<User | null>): Unsubscribe
}

export interface CreateWorkspaceInput {
  name: string
  icon: string
  description: string
  owner: SessionUser
}

export interface WorkspaceRepository {
  listForUser(uid: string): Promise<Workspace[]>
  subscribeForUser(
    uid: string,
    callback: Subscriber<Workspace[]>,
    onError?: (error: Error) => void,
  ): Unsubscribe
  get(workspaceId: string): Promise<Workspace | null>
  create(input: CreateWorkspaceInput): Promise<Workspace>
  update(workspaceId: string, patch: Partial<Pick<Workspace, 'name' | 'icon' | 'description'>>): Promise<void>
  remove(workspaceId: string): Promise<void>
  listMembers(workspaceId: string): Promise<Member[]>
  subscribeMembers(workspaceId: string, callback: Subscriber<Member[]>): Unsubscribe
  addMember(
    workspaceId: string,
    member: Omit<Member, 'id' | 'workspaceId'>,
    inviteCode?: string,
  ): Promise<void>
  updateMemberRole(workspaceId: string, uid: string, role: Role): Promise<void>
  removeMember(workspaceId: string, uid: string): Promise<void>
  createInvite(workspaceId: string, createdBy: string): Promise<Invite>
  getInvite(code: string): Promise<Invite | null>
  acceptInvite(code: string, user: SessionUser): Promise<Workspace>
}

export interface ChannelInput {
  workspaceId: string
  name: string
  description: string
  type: 'public' | 'private'
  createdBy: string
  memberIds?: string[]
}

export interface ChannelRepository {
  list(workspaceId: string): Promise<Channel[]>
  subscribe(workspaceId: string, callback: Subscriber<Channel[]>): Unsubscribe
  create(input: ChannelInput): Promise<Channel>
  update(
    workspaceId: string,
    channelId: string,
    patch: Partial<Pick<Channel, 'name' | 'description' | 'archived' | 'memberIds'>>,
  ): Promise<void>
  remove(workspaceId: string, channelId: string): Promise<void>
}

export interface SendMessageInput {
  workspaceId: string
  channelId: string
  author: Pick<SessionUser, 'id' | 'displayName' | 'photoURL'>
  body: string
  attachmentIds?: string[]
  replyToId?: string | null
}

export interface MessageRepository {
  list(workspaceId: string, channelId: string, limit?: number): Promise<Message[]>
  subscribe(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<Message[]>,
    limit?: number,
  ): Unsubscribe
  send(input: SendMessageInput): Promise<Message>
  updateBody(workspaceId: string, channelId: string, messageId: string, body: string): Promise<void>
  remove(workspaceId: string, channelId: string, messageId: string): Promise<void>
  toggleReaction(
    workspaceId: string,
    channelId: string,
    messageId: string,
    emoji: string,
    uid: string,
  ): Promise<void>
  /** Publica o retira el indicador «escribiendo…» del usuario en el canal. */
  setTyping(
    workspaceId: string,
    channelId: string,
    user: { id: string; displayName: string },
    active: boolean,
  ): Promise<void>
  subscribeTyping(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<TypingUser[]>,
  ): Unsubscribe
  /** Marca el canal como leído hasta `at` para el usuario. */
  markRead(workspaceId: string, channelId: string, uid: string, at: string): Promise<void>
  /** Última lectura de cada miembro del canal, por uid. */
  subscribeReads(
    workspaceId: string,
    channelId: string,
    callback: Subscriber<Record<string, string>>,
  ): Unsubscribe
}

export interface BoardInput {
  workspaceId: string
  name: string
  description: string
  createdBy: string
  columns?: BoardColumn[]
}

export interface BoardRepository {
  list(workspaceId: string): Promise<Board[]>
  subscribe(workspaceId: string, callback: Subscriber<Board[]>): Unsubscribe
  create(input: BoardInput): Promise<Board>
  update(
    workspaceId: string,
    boardId: string,
    patch: Partial<Pick<Board, 'name' | 'description' | 'columns' | 'hiddenLabels' | 'customLabels'>>,
  ): Promise<void>
  remove(workspaceId: string, boardId: string): Promise<void>
}

export interface TaskRepository {
  list(workspaceId: string, boardId: string): Promise<Task[]>
  subscribe(
    workspaceId: string,
    boardId: string,
    callback: Subscriber<Task[]>,
  ): Unsubscribe
  create(input: TaskDraftInput): Promise<Task>
  update(
    workspaceId: string,
    boardId: string,
    taskId: string,
    patch: Partial<
      Pick<
        Task,
        | 'title'
        | 'description'
        | 'priority'
        | 'dueDate'
        | 'assigneeIds'
        | 'reviewerId'
        | 'dependsOnTaskIds'
        | 'labels'
        | 'attachmentIds'
      >
    >,
  ): Promise<void>
  move(
    workspaceId: string,
    boardId: string,
    taskId: string,
    toColumnId: string,
    toIndex: number,
    columns: BoardColumn[],
  ): Promise<void>
  transfer(
    workspaceId: string,
    boardId: string,
    taskId: string,
    target: {
      workspaceId: string
      boardId: string
      columnId: string
      attachmentIds?: string[]
    },
    actorId: string,
  ): Promise<Task>
  remove(workspaceId: string, boardId: string, taskId: string): Promise<void>
  subscribeComments(
    workspaceId: string,
    boardId: string,
    taskId: string,
    callback: Subscriber<TaskComment[]>,
  ): Unsubscribe
  addComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    comment: Omit<TaskComment, 'id' | 'taskId' | 'workspaceId' | 'boardId' | 'createdAt'>,
  ): Promise<TaskComment>
  removeComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    commentId: string,
  ): Promise<void>
  updateComment(
    workspaceId: string,
    boardId: string,
    taskId: string,
    commentId: string,
    body: string,
  ): Promise<void>
}

export interface PageRepository {
  list(workspaceId: string): Promise<Page[]>
  subscribe(workspaceId: string, callback: Subscriber<Page[]>): Unsubscribe
  create(input: PageDraftInput): Promise<Page>
  update(
    workspaceId: string,
    pageId: string,
    patch: Partial<Pick<Page, 'title' | 'icon' | 'content' | 'parentId' | 'archived'>> & {
      updatedBy: string
    },
  ): Promise<void>
  remove(workspaceId: string, pageId: string): Promise<void>
}

export interface UploadFile {
  name: string
  size: number
  contentType: string
  data: Blob
}

export interface UploadOptions {
  folderId?: string | null
  onProgress?: (percent: number) => void
}

export interface FileUpdate {
  name?: string
  folderId?: string | null
  trashedAt?: string | null
}

export interface FileRepository {
  list(workspaceId: string): Promise<FileMeta[]>
  subscribe(workspaceId: string, callback: Subscriber<FileMeta[]>): Unsubscribe
  upload(
    workspaceId: string,
    file: UploadFile,
    uploadedBy: string,
    options?: UploadOptions,
  ): Promise<FileMeta>
  update(workspaceId: string, fileId: string, patch: FileUpdate): Promise<void>
  /** Resuelve el contenido de un archivo solo cuando se necesita. */
  getDownloadUrl(workspaceId: string, file: FileMeta): Promise<string>
  /** Descarga el contenido binario para copiarlo entre espacios. */
  downloadBlob(workspaceId: string, file: FileMeta): Promise<Blob>
  readText(workspaceId: string, file: FileMeta): Promise<string>
  updateText(workspaceId: string, file: FileMeta, text: string): Promise<void>
  remove(workspaceId: string, fileId: string): Promise<void>
}

export interface FolderInput {
  workspaceId: string
  name: string
  parentId?: string | null
  createdBy: string
}

export interface FileFolderRepository {
  list(workspaceId: string): Promise<FileFolder[]>
  subscribe(workspaceId: string, callback: Subscriber<FileFolder[]>): Unsubscribe
  create(input: FolderInput): Promise<FileFolder>
  update(
    workspaceId: string,
    folderId: string,
    patch: Pick<FileFolder, 'name'> & { parentId?: string | null },
  ): Promise<void>
  remove(workspaceId: string, folderId: string): Promise<void>
}

export interface McpTokenRepository {
  list(uid: string): Promise<McpToken[]>
  create(input: McpTokenDraft): Promise<McpToken>
  /** Elimina el token. Deja de funcionar inmediatamente y desaparece de la lista. */
  remove(uid: string, tokenId: string): Promise<void>
}

export interface DeviceRepository {
  register(uid: string, input: RegisterDeviceInput): Promise<PushDevice>
  remove(uid: string, deviceId: string): Promise<void>
  setEnabled(uid: string, deviceId: string, enabled: boolean): Promise<void>
  get(uid: string, deviceId: string): Promise<PushDevice | null>
  list(uid: string): Promise<PushDevice[]>
}

export interface PushOutbox {
  /** Persiste el evento para que el Worker lo entregue. Devuelve su id. */
  enqueue(event: PushEvent): Promise<string>
  /** Intenta entregar ya; si falla, el cron del Worker lo reintentará. */
  dispatch(outboxId: string): Promise<void>
}

export interface PushPermissionState {
  status: 'granted' | 'denied' | 'prompt' | 'unsupported'
}

/** Puerta de entrada a los plugins nativos de notificaciones. */
export interface PushGateway {
  isSupported(): boolean
  permission(): Promise<PushPermissionState>
  requestPermission(): Promise<PushPermissionState>
  /** Conecta los listeners nativos (token y tap). */
  initialize(): Promise<void>
  /** Pide a FCM/APNs un token nuevo; se recibe por `onToken`. */
  register(): Promise<void>
  deviceId(): string
  platform(): 'android' | 'ios'
  appVersion(): Promise<string | null>
  onToken(callback: Subscriber<string>): Unsubscribe
  onNotificationTap(callback: Subscriber<string>): Unsubscribe
}

/** Login de Google fuera del WebView (Credential Manager / Play Services). */
export interface GoogleSignInPort {
  isAvailable(): boolean
  signIn(): Promise<{ idToken: string }>
}

export interface AppContainer {
  mode: 'firebase' | 'demo'
  auth: AuthPort
  users: UserRepository
  workspaces: WorkspaceRepository
  channels: ChannelRepository
  messages: MessageRepository
  boards: BoardRepository
  tasks: TaskRepository
  pages: PageRepository
  files: FileRepository
  fileFolders: FileFolderRepository
  mcpTokens: McpTokenRepository
  devices: DeviceRepository
  pushOutbox: PushOutbox
  pushGateway: PushGateway
  resetDemo?: () => Promise<void>
}
