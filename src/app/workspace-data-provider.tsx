import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Channel, FileFolder, FileMeta } from '@/domain/entities/chat'
import type { Member, Role, Workspace } from '@/domain/entities/identity'
import type { Board } from '@/domain/entities/kanban'
import type { Page } from '@/domain/entities/pages'
import { can as canDo, type PermissionAction } from '@/domain/services/permission-service'
import { useAuth, useContainer } from './auth-provider'

interface WorkspaceDataValue {
  workspace: Workspace
  uid: string
  role: Role
  members: Member[]
  channels: Channel[]
  boards: Board[]
  pages: Page[]
  files: FileMeta[]
  trashedFiles: FileMeta[]
  folders: FileFolder[]
  loading: boolean
  can: (action: PermissionAction) => boolean
}

const WorkspaceDataContext = createContext<WorkspaceDataValue | null>(null)

export function WorkspaceDataProvider({
  workspace,
  children,
}: {
  workspace: Workspace
  children: ReactNode
}) {
  const container = useContainer()
  const { session } = useAuth()
  const uid = session?.id ?? ''
  const [members, setMembers] = useState<Member[] | null>(null)
  const [allChannels, setAllChannels] = useState<Channel[] | null>(null)
  const [boards, setBoards] = useState<Board[] | null>(null)
  const [pages, setPages] = useState<Page[] | null>(null)
  const [allFiles, setAllFiles] = useState<FileMeta[] | null>(null)
  const [folders, setFolders] = useState<FileFolder[] | null>(null)

  useEffect(() => {
    setMembers(null)
    setAllChannels(null)
    setBoards(null)
    setPages(null)
    setAllFiles(null)
    setFolders(null)
    const unsubscribers = [
      container.workspaces.subscribeMembers(workspace.id, setMembers),
      container.channels.subscribe(workspace.id, setAllChannels),
      container.boards.subscribe(workspace.id, setBoards),
      container.pages.subscribe(workspace.id, setPages),
      container.files.subscribe(workspace.id, setAllFiles),
      container.fileFolders.subscribe(workspace.id, setFolders),
    ]
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [container, workspace.id])

  const role: Role = useMemo(() => {
    const membership = (members ?? []).find((member) => member.uid === uid)
    if (membership) return membership.role
    if (workspace.ownerId === uid) return 'owner'
    return 'member'
  }, [members, uid, workspace.ownerId])

  const channels = useMemo(() => {
    const list = allChannels ?? []
    return list.filter(
      (channel) =>
        !channel.archived &&
        (channel.type === 'public' ||
          channel.memberIds.includes(uid) ||
          canDo(role, 'channel.manage')),
    )
  }, [allChannels, role, uid])

  const can = useMemo(
    () => (action: PermissionAction) => canDo(role, action),
    [role],
  )

  const normalizedFiles = useMemo(() => {
    const validFolders = new Set((folders ?? []).map((folder) => folder.id))
    return (allFiles ?? []).map((file) =>
      file.folderId && !validFolders.has(file.folderId) ? { ...file, folderId: null } : file,
    )
  }, [allFiles, folders])

  const value = useMemo<WorkspaceDataValue>(
    () => ({
      workspace,
      uid,
      role,
      members: members ?? [],
      channels,
      boards: boards ?? [],
      pages: (pages ?? []).filter((page) => !page.archived),
      files: normalizedFiles.filter((file) => !file.trashedAt),
      trashedFiles: normalizedFiles.filter((file) => Boolean(file.trashedAt)),
      folders: folders ?? [],
      loading: [members, allChannels, boards, pages, allFiles, folders].some(
        (value) => value === null,
      ),
      can,
    }),
    [
      allChannels,
      allFiles,
      boards,
      can,
      channels,
      folders,
      members,
      normalizedFiles,
      pages,
      role,
      uid,
      workspace,
    ],
  )

  return (
    <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>
  )
}

export function useWorkspaceData(): WorkspaceDataValue {
  const context = useContext(WorkspaceDataContext)
  if (!context) {
    throw new Error('useWorkspaceData debe usarse dentro de <WorkspaceDataProvider>.')
  }
  return context
}
