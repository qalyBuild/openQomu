import { useEffect, useMemo, useState } from 'react'
import type { Message, TypingUser } from '@/domain/entities/chat'
import type { Task, TaskComment } from '@/domain/entities/kanban'
import { activeTypers } from '@/domain/services/message-service'
import { useContainer } from '@/app/auth-provider'

export function useMessages(workspaceId: string, channelId: string | undefined) {
  const container = useContainer()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!channelId) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = container.messages.subscribe(
        workspaceId,
        channelId,
        (next) => {
          setMessages(next)
          setLoading(false)
        },
        300,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los mensajes.')
      setLoading(false)
    }
    return () => unsubscribe?.()
  }, [channelId, container, workspaceId])

  return { messages, loading, error }
}

/** Miembros que están escribiendo ahora en el canal (sin el usuario actual). */
export function useTypingUsers(
  workspaceId: string,
  channelId: string | undefined,
  uid: string,
) {
  const container = useContainer()
  const [users, setUsers] = useState<TypingUser[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!channelId) {
      setUsers([])
      return
    }
    return container.messages.subscribeTyping(workspaceId, channelId, setUsers)
  }, [channelId, container, workspaceId])

  // Los indicadores caducan solos si el emisor cierra la app sin avisar.
  useEffect(() => {
    if (users.length === 0) return
    const timer = window.setInterval(() => setNow(Date.now()), 2000)
    return () => window.clearInterval(timer)
  }, [users.length])

  return useMemo(() => activeTypers(users, { uid, now }), [now, uid, users])
}

/** Última lectura de cada miembro del canal, por uid. */
export function useChannelReads(workspaceId: string, channelId: string | undefined) {
  const container = useContainer()
  const [reads, setReads] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!channelId) {
      setReads({})
      return
    }
    return container.messages.subscribeReads(workspaceId, channelId, setReads)
  }, [channelId, container, workspaceId])

  return reads
}

export function useBoardTasks(workspaceId: string, boardId: string | undefined) {
  const container = useContainer()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boardId) {
      setTasks([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = container.tasks.subscribe(workspaceId, boardId, (next) => {
      setTasks(next)
      setLoading(false)
    })
    return unsubscribe
  }, [boardId, container, workspaceId])

  return { tasks, setTasks, loading }
}

export function useWorkspaceTasks(workspaceId: string, boardIds: string[]) {
  const container = useContainer()
  const [tasksByBoard, setTasksByBoard] = useState<Record<string, Task[]>>({})
  const [loading, setLoading] = useState(true)
  const boardKey = useMemo(() => [...boardIds].sort().join('|'), [boardIds])

  useEffect(() => {
    const ids = boardKey ? boardKey.split('|') : []
    if (ids.length === 0) {
      setTasksByBoard({})
      setLoading(false)
      return
    }
    setLoading(true)
    const pending = new Set(ids)
    const unsubscribers = ids.map((boardId) =>
      container.tasks.subscribe(workspaceId, boardId, (next) => {
        setTasksByBoard((current) => ({ ...current, [boardId]: next }))
        pending.delete(boardId)
        if (pending.size === 0) setLoading(false)
      }),
    )
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [boardKey, container, workspaceId])

  const tasks = useMemo(
    () => (boardKey ? boardKey.split('|').flatMap((boardId) => tasksByBoard[boardId] ?? []) : []),
    [boardKey, tasksByBoard],
  )

  return { tasks, tasksByBoard, loading }
}

export function useTaskComments(
  workspaceId: string,
  boardId: string | undefined,
  taskId: string | undefined,
) {
  const container = useContainer()
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boardId || !taskId) {
      setComments([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = container.tasks.subscribeComments(
      workspaceId,
      boardId,
      taskId,
      (next) => {
        setComments(next)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [boardId, container, taskId, workspaceId])

  return { comments, loading }
}
