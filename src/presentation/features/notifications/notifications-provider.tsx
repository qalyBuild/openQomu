import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import type { Message } from '@/domain/entities/chat'
import type { TaskComment } from '@/domain/entities/kanban'
import { isBoardMuted, isDependentsColumn } from '@/domain/entities/kanban'
import {
  collectActivityNotifications,
  collectCommentNotifications,
  collectMessageNotifications,
  collectTaskNotifications,
  newNotificationIds,
  summarizeNotifications,
  type NotificationSummary,
} from '@/domain/services/notification-service'
import { isTaskCompleted } from '@/domain/services/task-service'
import {
  advanceFileRead,
  defaultNotificationState,
  legacyFileVisit,
  loadNotificationState,
  markNotificationRead,
  saveNotificationState,
  setSeenNotificationIds,
  setSoundEnabled,
  setNotificationSound,
  setSoundVolume,
  type NotificationState,
} from '@/lib/notification-storage'
import { playNotificationSound, type AudioContextLike } from '@/lib/notification-sound'
import { isNativeApp } from '@/lib/app-url'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useWorkspaceTasks } from '@/presentation/hooks/use-data'
import { useFileRead } from './use-file-read'

const MAX_COMMENT_SUBSCRIPTIONS = 25

interface NotificationValue extends NotificationSummary {
  soundEnabled: boolean
  /** Volumen del sonido entre 0 y 1. */
  volume: number
  /** Id del sonido elegido en el catálogo. */
  soundId: string
  toggleSound: () => void
  setVolume: (volume: number) => void
  setSoundId: (soundId: string) => void
  /** Reproduce un sonido ahora, para probarlo desde Ajustes. */
  previewSound: (soundId?: string) => void
}

const NotificationsContext = createContext<NotificationValue | null>(null)

function channelIdFromPath(pathname: string): string | undefined {
  return pathname.match(/\/c\/([^/]+)/)?.[1]
}

function latestCreatedAt(messages: Message[] | undefined): string | undefined {
  let latest: string | undefined
  for (const message of messages ?? []) {
    if (!latest || message.createdAt > latest) latest = message.createdAt
  }
  return latest
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const {
    workspace,
    uid,
    channels,
    boards,
    pages,
    files,
    members,
    loading,
  } = useWorkspaceData()
  const { session, profile } = useAuth()
  const container = useContainer()
  const location = useLocation()

  const stateKey = `${uid}:${workspace.id}`
  const [state, setState] = useState<NotificationState>(() =>
    loadNotificationState(uid, workspace.id),
  )
  const loadedKey = useRef(stateKey)
  useEffect(() => {
    if (loadedKey.current === stateKey) return
    loadedKey.current = stateKey
    setState(loadNotificationState(uid, workspace.id))
  }, [stateKey, uid, workspace.id])

  useEffect(() => {
    saveNotificationState(uid, workspace.id, state)
  }, [uid, workspace.id, state])

  // --- Mensajes de todos los canales visibles -----------------------------
  const channelKey = useMemo(() => channels.map((channel) => channel.id).sort().join('|'), [channels])
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, Message[]>>({})
  useEffect(() => {
    setMessagesByChannel({})
    const ids = channelKey ? channelKey.split('|') : []
    if (ids.length === 0) return
    const unsubscribers = ids.map((channelId) =>
      container.messages.subscribe(workspace.id, channelId, (next) => {
        setMessagesByChannel((current) => ({ ...current, [channelId]: next }))
      }, 50),
    )
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [channelKey, container, workspace.id])

  // Espera la primera lectura del servidor antes de contar mensajes de un canal.
  const [remoteReads, setRemoteReads] = useState<{
    scope: string
    byChannel: Record<string, string | null>
  }>({ scope: stateKey, byChannel: {} })
  useEffect(() => {
    if (!uid || !channelKey) return
    const unsubscribers = channelKey.split('|').map((channelId) =>
      container.messages.subscribeRead(workspace.id, channelId, uid, (at) => {
        setRemoteReads((current) => {
          const byChannel = current.scope === stateKey ? current.byChannel : {}
          if (byChannel[channelId] === at) return current
          return { scope: stateKey, byChannel: { ...byChannel, [channelId]: at } }
        })
      }),
    )
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [channelKey, container, stateKey, uid, workspace.id])

  // --- Tareas de todos los tableros ---------------------------------------
  const boardKey = useMemo(() => boards.map((board) => board.id).join('|'), [boards])
  const boardIds = useMemo(() => (boardKey ? boardKey.split('|') : []), [boardKey])
  const { tasks } = useWorkspaceTasks(workspace.id, boardIds)
  const columnsByBoard = useMemo(
    () => Object.fromEntries(boards.map((board) => [board.id, board.columns])),
    [boards],
  )
  const tasksRef = useRef(tasks)
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  const myOpenTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (!task.assigneeIds.includes(uid)) return false
        const columns = columnsByBoard[task.boardId] ?? []
        const column = columns.find((candidate) => candidate.id === task.columnId)
        if (column && isDependentsColumn(column)) return false
        return !isTaskCompleted(task, columns)
      }),
    [columnsByBoard, tasks, uid],
  )

  // --- Comentarios de las tareas que tengo asignadas ----------------------
  const commentTaskKey = useMemo(
    () =>
      myOpenTasks
        .slice(0, MAX_COMMENT_SUBSCRIPTIONS)
        .map((task) => task.id)
        .sort()
        .join('|'),
    [myOpenTasks],
  )
  const [commentsByTask, setCommentsByTask] = useState<Record<string, TaskComment[]>>({})
  useEffect(() => {
    const ids = commentTaskKey ? commentTaskKey.split('|') : []
    if (ids.length === 0) {
      setCommentsByTask({})
      return
    }
    const byId = new Map(tasksRef.current.map((task) => [task.id, task]))
    const unsubscribers = ids.map((taskId) => {
      const task = byId.get(taskId)
      if (!task) return () => {}
      return container.tasks.subscribeComments(workspace.id, task.boardId, taskId, (next) => {
        setCommentsByTask((current) => ({ ...current, [taskId]: next }))
      })
    })
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [commentTaskKey, container, workspace.id])

  // --- Marcado de lectura según la ruta -----------------------------------
  const pathname = location.pathname
  const activeChannelId = channelIdFromPath(pathname)
  useEffect(() => {
    const now = new Date().toISOString()
    setState((current) => {
      if (activeChannelId && document.visibilityState !== 'hidden') {
        return markNotificationRead(current, `channel:${activeChannelId}`, now)
      }
      if (pathname.includes('/pages')) return markNotificationRead(current, 'pages', now)
      if (pathname.includes('/members')) return markNotificationRead(current, 'members', now)
      if (pathname.includes('/boards')) return markNotificationRead(current, 'comments', now)
      return current
    })
  }, [activeChannelId, pathname])

  const advanceFiles = useCallback((through: number) => {
    setState((current) => advanceFileRead(current, through))
  }, [])
  const { ready: filesReady, through: fileReadThrough } = useFileRead({
    repository: container.fileReads,
    workspaceId: workspace.id,
    uid,
    files,
    loading,
    viewingFiles: pathname.replace(/\/$/, '') === `/w/${workspace.id}/files`,
    localThrough: state.fileReadThrough ?? 0,
    legacyVisit: legacyFileVisit(state),
    onAdvance: advanceFiles,
  })

  // Mientras el canal está abierto, lo que llega se considera leído.
  const activeLastMessageAt = latestCreatedAt(activeChannelId ? messagesByChannel[activeChannelId] : undefined)
  useEffect(() => {
    if (!activeChannelId || !activeLastMessageAt || document.visibilityState === 'hidden') return
    setState((current) =>
      markNotificationRead(current, `channel:${activeChannelId}`, activeLastMessageAt),
    )
  }, [activeChannelId, activeLastMessageAt])

  // Los canales estrenan una ventana de 24 h la primera vez.
  useEffect(() => {
    if (channels.length === 0) return
    const baseline = defaultNotificationState().lastReadAt.pages
    setState((current) => {
      const missing = channels.filter((channel) => !current.lastReadAt[`channel:${channel.id}`])
      if (missing.length === 0) return current
      const lastReadAt = { ...current.lastReadAt }
      for (const channel of missing) lastReadAt[`channel:${channel.id}`] = baseline
      return { ...current, lastReadAt }
    })
  }, [channels])

  // --- Cálculo de avisos ---------------------------------------------------
  const displayName =
    members.find((member) => member.uid === uid)?.displayName ??
    profile?.displayName ??
    session?.displayName ??
    null
  const { readyChannels, lastReadByChannel } = useMemo(() => {
    const byChannel = remoteReads.scope === stateKey ? remoteReads.byChannel : {}
    const readyChannels = channels.filter((channel) => Object.hasOwn(byChannel, channel.id))
    const lastReadByChannel = Object.fromEntries(
      readyChannels.map(({ id }) => {
        const local = state.lastReadAt[`channel:${id}`]
        const remote = byChannel[id]
        return [id, remote && (!local || remote > local) ? remote : local]
      }),
    )
    return { readyChannels, lastReadByChannel }
  }, [channels, remoteReads, state.lastReadAt, stateKey])

  const items = useMemo(
    () => [
      ...collectMessageNotifications({
        channels: readyChannels,
        messagesByChannel,
        lastReadByChannel,
        uid,
        displayName,
      }),
      ...collectTaskNotifications({ tasks, columnsByBoard, uid }),
      ...collectCommentNotifications({
        tasks: myOpenTasks,
        commentsByTask,
        lastReadAt: state.lastReadAt.comments,
        uid,
        displayName,
      }),
      ...collectActivityNotifications({
        pages,
        files: filesReady ? files : [],
        members,
        uid,
        lastReadAt: {
          ...state.lastReadAt,
          files: fileReadThrough ? new Date(fileReadThrough).toISOString() : state.lastReadAt.files,
        },
      }),
    ],
    [
      readyChannels,
      columnsByBoard,
      commentsByTask,
      displayName,
      files,
      filesReady,
      fileReadThrough,
      lastReadByChannel,
      members,
      messagesByChannel,
      myOpenTasks,
      pages,
      state.lastReadAt,
      tasks,
      uid,
    ],
  )
  const mutedBoardIds = useMemo(
    () => new Set(boards.filter((board) => isBoardMuted(board.status)).map((board) => board.id)),
    [boards],
  )
  const visibleItems = useMemo(
    () => items.filter((item) => item.section !== 'boards' || !mutedBoardIds.has(item.targetId)),
    [items, mutedBoardIds],
  )
  const summary = useMemo(() => summarizeNotifications(visibleItems), [visibleItems])
  const itemIds = useMemo(() => items.map((item) => item.id), [items])

  // --- Sonido --------------------------------------------------------------
  const hydrated = useRef(false)
  const seenIds = useRef<Set<string>>(new Set())
  const soundEnabledRef = useRef(state.soundEnabled)
  useEffect(() => {
    soundEnabledRef.current = state.soundEnabled
  }, [state.soundEnabled])
  const volumeRef = useRef(state.soundVolume)
  useEffect(() => {
    volumeRef.current = state.soundVolume
  }, [state.soundVolume])
  const soundIdRef = useRef(state.soundId)
  useEffect(() => {
    soundIdRef.current = state.soundId
  }, [state.soundId])
  const audioContext = useRef<AudioContextLike | null>(null)

  const ensureAudioContext = useCallback((): AudioContextLike | null => {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      if (!audioContext.current) {
        audioContext.current = new Ctor() as unknown as AudioContextLike
      }
      return audioContext.current
    } catch {
      // Sin audio disponible; los avisos visuales siguen funcionando.
      return null
    }
  }, [])

  useEffect(() => {
    const unlock = () => {
      const context = ensureAudioContext()
      if (context) void (context as unknown as AudioContext).resume?.()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [ensureAudioContext])

  // Rehidratar al cambiar de usuario o espacio, antes del efecto de
  // hidratación para que este vuelva a empezar en limpio y sin sonar.
  useEffect(() => {
    hydrated.current = false
    seenIds.current = new Set()
  }, [stateKey])

  useEffect(() => {
    if (loading) return
    if (!hydrated.current) {
      hydrated.current = true
      seenIds.current = new Set(itemIds)
      setState((current) => setSeenNotificationIds(current, itemIds))
      return
    }
    const fresh = newNotificationIds([...seenIds.current], visibleItems)
    // En el APK el sonido lo pone la notificación nativa: evitar el doble aviso.
    if (fresh.length > 0 && soundEnabledRef.current && !isNativeApp()) {
      playNotificationSound(audioContext.current, volumeRef.current, soundIdRef.current)
    }
    // Conserva también los IDs silenciados para evitar sonidos atrasados al reactivar.
    seenIds.current = new Set(itemIds)
    setState((current) => setSeenNotificationIds(current, itemIds))
  }, [itemIds, visibleItems, loading])

  const toggleSound = useCallback(() => {
    setState((current) => setSoundEnabled(current, !current.soundEnabled))
  }, [])

  const setVolume = useCallback((volume: number) => {
    setState((current) => setSoundVolume(current, volume))
  }, [])

  const setSoundId = useCallback((soundId: string) => {
    setState((current) => setNotificationSound(current, soundId))
  }, [])

  const previewSound = useCallback(
    (soundId?: string) => {
      const context = ensureAudioContext()
      if (!context) return
      const resume = (context as unknown as AudioContext).resume
      const result = typeof resume === 'function' ? resume.call(context) : undefined
      const play = () =>
        playNotificationSound(context, volumeRef.current, soundId ?? soundIdRef.current)
      if (result && typeof result.then === 'function') void result.then(play)
      else play()
    },
    [ensureAudioContext],
  )

  const value = useMemo<NotificationValue>(
    () => ({
      ...summary,
      soundEnabled: state.soundEnabled,
      volume: state.soundVolume,
      soundId: state.soundId,
      toggleSound,
      setVolume,
      setSoundId,
      previewSound,
    }),
    [
      previewSound,
      setSoundId,
      setVolume,
      state.soundEnabled,
      state.soundId,
      state.soundVolume,
      summary,
      toggleSound,
    ],
  )

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotifications(): NotificationValue {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de <NotificationsProvider>.')
  }
  return context
}
