import type {
  Channel,
  ChannelRead,
  FileFolder,
  FileMeta,
  Message,
  TypingUser,
} from '@/domain/entities/chat'
import type {
  Invite,
  Member,
  User,
  Workspace,
} from '@/domain/entities/identity'
import type { Board, Task, TaskComment } from '@/domain/entities/kanban'
import type { Page } from '@/domain/entities/pages'
import { EMPTY_PAGE_CONTENT } from '@/domain/entities/pages'
import { DEFAULT_BOARD_COLUMNS } from '@/domain/entities/kanban'

export const DEMO_WORKSPACE_ID = 'demo-space'
export const DEMO_USER_ID = 'u-alex'

export interface DemoState {
  users: Record<string, User>
  workspaces: Record<string, Workspace>
  members: Record<string, Member>
  invites: Record<string, Invite>
  channels: Record<string, Channel>
  messages: Record<string, Message>
  /** Clave `channelId:uid`. */
  typing: Record<string, TypingUser>
  /** Clave `channelId:uid`. */
  reads: Record<string, ChannelRead>
  boards: Record<string, Board>
  tasks: Record<string, Task>
  comments: Record<string, TaskComment>
  pages: Record<string, Page>
  files: Record<string, FileMeta>
  folders: Record<string, FileFolder>
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function inDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function pageContent(blocks: Array<{ type: string; text?: string; checked?: boolean }>): string {
  return JSON.stringify({
    type: 'doc',
    content: blocks.map((block) => {
      if (block.type === 'heading') {
        return {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: block.text }],
        }
      }
      if (block.type === 'check') {
        return {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: block.checked ?? false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: block.text }] }],
            },
          ],
        }
      }
      return { type: 'paragraph', content: [{ type: 'text', text: block.text }] }
    }),
  })
}

const users: User[] = [
  {
    id: DEMO_USER_ID,
    displayName: 'Alex Rivera',
    email: 'alex@example.com',
    photoURL: null,
    createdAt: daysAgo(180),
    lastActiveAt: minutesAgo(1),
  },
  {
    id: 'u-ana',
    displayName: 'Ana Torres',
    email: 'ana@example.com',
    photoURL: null,
    createdAt: daysAgo(175),
    lastActiveAt: minutesAgo(4),
  },
  {
    id: 'u-bruno',
    displayName: 'Bruno Vidal',
    email: 'bruno@example.com',
    photoURL: null,
    createdAt: daysAgo(170),
    lastActiveAt: minutesAgo(12),
  },
  {
    id: 'u-carla',
    displayName: 'Carla Méndez',
    email: 'carla@example.com',
    photoURL: null,
    createdAt: daysAgo(160),
    lastActiveAt: minutesAgo(45),
  },
  {
    id: 'u-diego',
    displayName: 'Diego Sosa',
    email: 'diego@example.com',
    photoURL: null,
    createdAt: daysAgo(12),
    lastActiveAt: daysAgo(3),
  },
]

const workspace: Workspace = {
  id: DEMO_WORKSPACE_ID,
  name: 'Espacio demo',
  icon: '🪐',
  description: 'El equipo que construye openQomu. Conversaciones, tareas y conocimiento en un solo lugar.',
  ownerId: DEMO_USER_ID,
  createdAt: daysAgo(180),
  memberIds: ['u-alex', 'u-ana', 'u-bruno', 'u-carla', 'u-diego'],
}

const memberSeed: Array<{
  uid: string
  role: Member['role']
  joinedAt: string
}> = [
  { uid: 'u-alex', role: 'owner', joinedAt: daysAgo(180) },
  { uid: 'u-ana', role: 'admin', joinedAt: daysAgo(175) },
  { uid: 'u-bruno', role: 'member', joinedAt: daysAgo(170) },
  { uid: 'u-carla', role: 'member', joinedAt: daysAgo(160) },
  { uid: 'u-diego', role: 'member', joinedAt: daysAgo(12) },
]

const members: Member[] = memberSeed.map(({ uid, role, joinedAt }) => {
  const user = users.find((candidate) => candidate.id === uid)!
  return {
    id: uid,
    workspaceId: DEMO_WORKSPACE_ID,
    uid,
    role,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    joinedAt,
    lastActiveAt: user.lastActiveAt,
  }
})

const channels: Channel[] = [
  {
    id: 'ch-general',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'general',
    description: 'Todo lo que el equipo necesita saber.',
    type: 'public',
    createdBy: DEMO_USER_ID,
    createdAt: daysAgo(180),
    archived: false,
    memberIds: [],
  },
  {
    id: 'ch-producto',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'producto',
    description: 'Decisiones de producto, roadmap y descubrimiento.',
    type: 'public',
    createdBy: 'u-ana',
    createdAt: daysAgo(170),
    archived: false,
    memberIds: [],
  },
  {
    id: 'ch-diseno',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'diseño',
    description: 'Referencias, prototipos y feedback visual.',
    type: 'public',
    createdBy: 'u-carla',
    createdAt: daysAgo(165),
    archived: false,
    memberIds: [],
  },
  {
    id: 'ch-lanzamiento',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'lanzamiento',
    description: 'Coordinación privada del lanzamiento de la beta.',
    type: 'private',
    createdBy: DEMO_USER_ID,
    createdAt: daysAgo(20),
    archived: false,
    memberIds: ['u-alex', 'u-ana'],
  },
]

const files: FileMeta[] = [
  {
    id: 'f-mockup',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'mockup-dashboard.png',
    path: 'demo/mockup-dashboard.png',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80',
    size: 482_300,
    contentType: 'image/png',
    uploadedBy: 'u-carla',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    folderId: 'folder-diseno',
    trashedAt: null,
    backend: 'local',
  },
  {
    id: 'f-brief',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'brief-beta.pdf',
    path: 'demo/brief-beta.pdf',
    url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    size: 132_640,
    contentType: 'application/pdf',
    uploadedBy: 'u-ana',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
    folderId: 'folder-docs',
    trashedAt: null,
    backend: 'local',
  },
  {
    id: 'f-brand',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'brand-system.png',
    path: 'demo/brand-system.png',
    url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1400&q=80',
    size: 356_900,
    contentType: 'image/png',
    uploadedBy: 'u-carla',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7),
    folderId: 'folder-diseno',
    trashedAt: null,
    backend: 'local',
  },
]

const folders: FileFolder[] = [
  {
    id: 'folder-diseno',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Diseño',
    parentId: null,
    createdBy: 'u-carla',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20),
  },
  {
    id: 'folder-beta',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Beta',
    parentId: 'folder-diseno',
    createdBy: 'u-carla',
    createdAt: daysAgo(18),
    updatedAt: daysAgo(18),
  },
  {
    id: 'folder-docs',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Documentos',
    parentId: null,
    createdBy: 'u-ana',
    createdAt: daysAgo(25),
    updatedAt: daysAgo(25),
  },
]

const messages: Message[] = [
  {
    id: 'msg-1',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-general',
    authorId: 'u-ana',
    authorName: 'Ana Torres',
    authorPhotoURL: null,
    body: 'Buenos días ☀️ ¿Cómo va el sprint? Recordad que el jueves revisamos el alcance de la beta.',
    createdAt: minutesAgo(190),
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: { '☀️': ['u-bruno', 'u-carla'], '🚀': ['u-alex'] },
    replyToId: null,
  },
  {
    id: 'msg-2',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-general',
    authorId: 'u-bruno',
    authorName: 'Bruno Vidal',
    authorPhotoURL: null,
    body: 'Terminé el drag & drop del kanban, con teclado incluido. Lo subo después de comer.',
    createdAt: minutesAgo(176),
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: { '🔥': ['u-ana', 'u-alex', 'u-carla'] },
    replyToId: null,
  },
  {
    id: 'msg-3',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-general',
    authorId: 'u-bruno',
    authorName: 'Bruno Vidal',
    authorPhotoURL: null,
    body: 'También dejé tests del dominio en verde ✅',
    createdAt: minutesAgo(175),
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: {},
    replyToId: null,
  },
  {
    id: 'msg-4',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-general',
    authorId: 'u-carla',
    authorName: 'Carla Méndez',
    authorPhotoURL: null,
    body: 'Comparto el último mockup del dashboard. Me inspiré en la calma de Notion y el ritmo de Linear. ¿Feedback?',
    createdAt: minutesAgo(120),
    editedAt: null,
    deletedAt: null,
    attachmentIds: ['f-mockup'],
    reactions: { '😍': ['u-ana', 'u-alex'] },
    replyToId: null,
  },
  {
    id: 'msg-5',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-general',
    authorId: 'u-alex',
    authorName: 'Alex Rivera',
    authorPhotoURL: null,
    body: 'Me encanta. Yo bajaría un punto el ruido del fondo y dejaría respirar las métricas.',
    createdAt: minutesAgo(112),
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: { '👍': ['u-carla'] },
    replyToId: 'msg-4',
  },
  {
    id: 'msg-6',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-general',
    authorId: 'u-alex',
    authorName: 'Alex Rivera',
    authorPhotoURL: null,
    body: 'Hoy cerramos el alcance de la beta. Si algo bloquea, lo hablamos aquí 🚀',
    createdAt: minutesAgo(60),
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: { '🚀': ['u-ana', 'u-bruno'], '💜': ['u-carla'] },
    replyToId: null,
  },
  {
    id: 'msg-7',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-producto',
    authorId: 'u-ana',
    authorName: 'Ana Torres',
    authorPhotoURL: null,
    body: 'Propuesta para la beta: invitaciones por enlace, kanban y páginas. Fuera: notificaciones push.',
    createdAt: minutesAgo(240),
    editedAt: null,
    deletedAt: null,
    attachmentIds: ['f-brief'],
    reactions: { '✅': ['u-alex', 'u-bruno', 'u-carla'] },
    replyToId: null,
  },
  {
    id: 'msg-8',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-producto',
    authorId: 'u-bruno',
    authorName: 'Bruno Vidal',
    authorPhotoURL: null,
    body: '¿La búsqueda global entra? Con ⌘K el coste es bajo y la sensación de producto cambia mucho.',
    createdAt: minutesAgo(230),
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: { '👀': ['u-ana'] },
    replyToId: null,
  },
  {
    id: 'msg-9',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-producto',
    authorId: 'u-ana',
    authorName: 'Ana Torres',
    authorPhotoURL: null,
    body: 'Sí, la metemos. La movemos a “En curso/rechazadas”.',
    createdAt: minutesAgo(228),
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: {},
    replyToId: 'msg-8',
  },
  {
    id: 'msg-10',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-diseno',
    authorId: 'u-carla',
    authorName: 'Carla Méndez',
    authorPhotoURL: null,
    body: 'Sistema de marca actualizado: violeta openQomu, neutros cálidos y tipografía Geist. Todo en la página de Diseño.',
    createdAt: minutesAgo(300),
    editedAt: null,
    deletedAt: null,
    attachmentIds: ['f-brand'],
    reactions: { '💜': ['u-alex', 'u-ana'] },
    replyToId: null,
  },
  {
    id: 'msg-11',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-diseno',
    authorId: 'u-alex',
    authorName: 'Alex Rivera',
    authorPhotoURL: null,
    body: 'El violeta funciona brutal en oscuro. ¿Probamos también un acento lima para los estados positivos?',
    createdAt: minutesAgo(285),
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: { '🎨': ['u-carla'] },
    replyToId: null,
  },
  {
    id: 'msg-12',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-lanzamiento',
    authorId: 'u-alex',
    authorName: 'Alex Rivera',
    authorPhotoURL: null,
    body: 'Checklist de beta: dominio, reglas de Firebase, datos semilla y vídeo de 60 s. ¿Algo más?',
    createdAt: minutesAgo(400),
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: { '📋': ['u-ana'] },
    replyToId: null,
  },
  {
    id: 'msg-13',
    workspaceId: DEMO_WORKSPACE_ID,
    channelId: 'ch-lanzamiento',
    authorId: 'u-ana',
    authorName: 'Ana Torres',
    authorPhotoURL: null,
    body: 'Añadiría una página con las preguntas frecuentes y el enlace de invitación fijado en general.',
    createdAt: minutesAgo(390),
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: {},
    replyToId: null,
  },
]

function task(
  id: string,
  title: string,
  columnId: string,
  order: number,
  overrides: Partial<Task> = {},
): Task {
  return {
    id,
    workspaceId: DEMO_WORKSPACE_ID,
    boardId: 'b-producto',
    title,
    description: '',
    columnId,
    order,
    assigneeIds: [],
    reviewerId: null,
    dependsOnTaskIds: [],
    priority: 'medium',
    dueDate: null,
    labels: [],
    attachmentIds: [],
    createdBy: DEMO_USER_ID,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1),
    completedAt: null,
    ...overrides,
  }
}

const productTasks: Task[] = [
  task('t-1', 'Definir el alcance de la beta', 'todo', 0, {
    description: 'Cerrar qué entra en la beta pública y qué queda para la v1.1. Validar con Ana y Bruno.',
    assigneeIds: ['u-ana'],
    priority: 'high',
    labels: ['producto'],
    dueDate: inDays(2),
    createdBy: 'u-ana',
    createdAt: daysAgo(2),
  }),
  task('t-2', 'Pulir onboarding y bienvenida', 'todo', 1, {
    description: 'Primera impresión: crear workspace, invitar equipo y primer mensaje guiado.',
    assigneeIds: ['u-carla'],
    priority: 'medium',
    labels: ['diseño', 'frontend'],
    dueDate: inDays(4),
    createdBy: 'u-carla',
    createdAt: daysAgo(3),
  }),
  task('t-3', 'Kanban: drag & drop accesible', 'doing', 0, {
    description: 'Soporte de puntero y teclado con dnd-kit. Persistir columna y orden en tiempo real.',
    assigneeIds: ['u-bruno'],
    reviewerId: 'u-alex',
    priority: 'high',
    labels: ['frontend'],
    dueDate: inDays(1),
    createdBy: 'u-bruno',
    createdAt: daysAgo(1),
    attachmentIds: ['f-mockup'],
  }),
  task('t-4', 'Editor de páginas con autoguardado', 'doing', 1, {
    description: 'TipTap con bloques, títulos y checklists. Debounce de 800 ms y estado de guardado visible.',
    assigneeIds: ['u-bruno'],
    priority: 'urgent',
    labels: ['frontend'],
    dueDate: inDays(3),
    createdBy: 'u-bruno',
    createdAt: daysAgo(4),
  }),
  task('t-5', 'Sistema de invitaciones por enlace', 'review', 0, {
    description: 'Código legible, caducidad de 7 días y unión sin fricción.',
    assigneeIds: ['u-alex'],
    reviewerId: 'u-bruno',
    priority: 'medium',
    labels: ['backend'],
    dueDate: inDays(5),
    createdBy: 'u-alex',
    createdAt: daysAgo(5),
  }),
  task('t-6', 'Revisión de copy en español', 'review', 1, {
    description: 'Tonos, tildes y microcopy de estados vacíos. Revisar toda la app.',
    assigneeIds: ['u-carla'],
    priority: 'low',
    labels: ['documentación'],
    dueDate: inDays(6),
    createdBy: 'u-ana',
    createdAt: daysAgo(6),
  }),
  task('t-7', 'Landing pública de openQomu', 'done', 0, {
    description: 'Hero, propuesta de valor y CTA de Google. Optimizada para móvil.',
    assigneeIds: ['u-carla'],
    priority: 'high',
    labels: ['marketing', 'diseño'],
    completedAt: daysAgo(2),
    createdBy: 'u-carla',
    createdAt: daysAgo(7),
  }),
  task('t-8', 'OAuth con Google', 'done', 1, {
    description: 'Login con popup y fallback a redirect. Perfil persistido.',
    assigneeIds: ['u-bruno'],
    priority: 'urgent',
    labels: ['backend'],
    completedAt: daysAgo(4),
    createdBy: 'u-bruno',
    createdAt: daysAgo(8),
  }),
  task('t-9', 'Dashboard de métricas', 'done', 2, {
    description: 'EvilCharts: tendencia, carga por persona y estados. Datos calculados en dominio.',
    assigneeIds: ['u-alex'],
    priority: 'medium',
    labels: ['frontend'],
    completedAt: daysAgo(1),
    createdBy: 'u-alex',
    createdAt: daysAgo(9),
  }),
  task('t-10', 'Archivos en mensajes y tareas', 'todo', 2, {
    description: 'Subida con progreso, límite de 25 MB y previews. Firebase Storage con fallback demo.',
    assigneeIds: ['u-bruno'],
    priority: 'high',
    labels: ['backend'],
    dueDate: inDays(7),
    createdBy: 'u-bruno',
    createdAt: daysAgo(2),
  }),
  task('t-11', 'Búsqueda global ⌘K', 'doing', 2, {
    description: 'Canales, páginas, tareas y personas. Resultados agrupados y navegables con teclado.',
    assigneeIds: ['u-ana'],
    priority: 'medium',
    labels: ['frontend'],
    dueDate: inDays(8),
    createdBy: 'u-ana',
    createdAt: daysAgo(3),
  }),
  task('t-12', 'Guía de estilo y tokens', 'done', 3, {
    description: 'Colores, radios, tipografía y sombras documentados en la página de Diseño.',
    assigneeIds: ['u-carla'],
    priority: 'low',
    labels: ['diseño'],
    completedAt: daysAgo(6),
    createdBy: 'u-carla',
    createdAt: daysAgo(11),
  }),
  task('t-13', 'Probar en móvil', 'todo', 3, {
    description: 'Revisar navegación, chat y kanban en pantallas pequeñas.',
    assigneeIds: ['u-alex'],
    priority: 'low',
    labels: ['bug'],
    dueDate: inDays(-1),
    createdBy: 'u-alex',
    createdAt: daysAgo(12),
  }),
]

const launchTasks: Task[] = [
  task('t-20', 'Vídeo de 60 segundos', 'todo', 0, {
    boardId: 'b-lanzamiento',
    description: 'Guion, captura de pantalla y música. Mostrar chat → tarea → página.',
    assigneeIds: ['u-carla'],
    priority: 'high',
    labels: ['marketing'],
    dueDate: inDays(5),
    createdBy: 'u-alex',
  }),
  task('t-21', 'Configurar dominio y HTTPS', 'doing', 0, {
    boardId: 'b-lanzamiento',
    description: 'Firebase Hosting, dominio personalizado y verificación DNS.',
    assigneeIds: ['u-bruno'],
    priority: 'urgent',
    labels: ['backend'],
    dueDate: inDays(1),
    createdBy: 'u-alex',
  }),
  task('t-22', 'FAQ de la beta', 'todo', 1, {
    boardId: 'b-lanzamiento',
    description: 'Preguntas frecuentes en una página pública dentro del workspace.',
    assigneeIds: ['u-ana'],
    priority: 'medium',
    labels: ['documentación'],
    dueDate: inDays(3),
    createdBy: 'u-ana',
  }),
  task('t-23', 'Plan de feedback', 'done', 0, {
    boardId: 'b-lanzamiento',
    description: 'Formulario, canal privado y sesiones con 5 equipos.',
    assigneeIds: ['u-ana'],
    priority: 'medium',
    labels: ['producto'],
    completedAt: daysAgo(3),
    createdBy: 'u-ana',
  }),
]

const boards: Board[] = [
  {
    id: 'b-producto',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Producto Q4',
    description: 'El camino a la beta pública de openQomu.',
    columns: DEFAULT_BOARD_COLUMNS,
    createdAt: daysAgo(30),
    createdBy: 'u-ana',
  },
  {
    id: 'b-lanzamiento',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Lanzamiento web',
    description: 'Todo lo necesario para abrir openQomu al mundo.',
    columns: DEFAULT_BOARD_COLUMNS,
    createdAt: daysAgo(15),
    createdBy: 'u-alex',
  },
]

const pages: Page[] = [
  {
    id: 'p-bienvenida',
    workspaceId: DEMO_WORKSPACE_ID,
    title: 'Bienvenido a openQomu 👋',
    icon: '👋',
    content: pageContent([
      { type: 'heading', text: 'Un espacio, todo el contexto' },
      {
        type: 'text',
        text: 'openQomu reúne conversaciones, tareas y documentación para que el equipo no pierda el hilo. Esta página es tu punto de partida.',
      },
      { type: 'heading', text: 'Tres formas de trabajar' },
      {
        type: 'text',
        text: 'Conversa en los canales, organiza el trabajo en los tableros y documenta decisiones en las páginas. Todo en tiempo real.',
      },
      { type: 'check', text: 'Explora el canal #general', checked: true },
      { type: 'check', text: 'Mira el tablero Producto Q4', checked: false },
      { type: 'check', text: 'Invita a tu equipo con un enlace', checked: false },
      { type: 'heading', text: 'Atajos' },
      { type: 'text', text: '⌘K abre la búsqueda global. G + C te lleva al chat, G + B al tablero y G + P a las páginas.' },
    ]),
    parentId: null,
    createdBy: DEMO_USER_ID,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(1),
    updatedBy: DEMO_USER_ID,
    archived: false,
  },
  {
    id: 'p-roadmap',
    workspaceId: DEMO_WORKSPACE_ID,
    title: 'Roadmap Q4',
    icon: '🗺️',
    content: pageContent([
      { type: 'heading', text: 'Objetivo del trimestre' },
      {
        type: 'text',
        text: 'Lanzar la beta pública con una experiencia completa de chat, kanban y documentos. Medir activación y retención semanal.',
      },
      { type: 'heading', text: 'Hitos' },
      { type: 'check', text: 'OAuth con Google y perfiles', checked: true },
      { type: 'check', text: 'Mensajería en tiempo real', checked: true },
      { type: 'check', text: 'Kanban con drag & drop', checked: true },
      { type: 'check', text: 'Dashboard con EvilCharts', checked: false },
      { type: 'check', text: 'Invitaciones y roles', checked: false },
      { type: 'heading', text: 'Métricas' },
      { type: 'text', text: 'Activación: crear workspace + enviar mensaje + crear tarea en la primera sesión. Retención: 3 días activos por semana.' },
    ]),
    parentId: null,
    createdBy: 'u-ana',
    createdAt: daysAgo(40),
    updatedAt: daysAgo(2),
    updatedBy: 'u-ana',
    archived: false,
  },
  {
    id: 'p-diseno',
    workspaceId: DEMO_WORKSPACE_ID,
    title: 'Diseño — Beta',
    icon: '🎨',
    content: pageContent([
      { type: 'heading', text: 'Principios' },
      { type: 'text', text: 'Calma visual, jerarquía clara y un acento violeta que guía la acción. Menos bordes, más espacio y transiciones suaves.' },
      { type: 'heading', text: 'Tokens' },
      { type: 'text', text: 'Violeta openQomu, neutros cálidos, radios de 10 px y sombras difusas. Tipografía Geist en UI y Geist Mono para código.' },
      { type: 'heading', text: 'Componentes' },
      { type: 'text', text: 'shadcn/ui como base. Iconos Lucide. Charts EvilCharts con gradientes y animaciones de entrada.' },
    ]),
    parentId: 'p-roadmap',
    createdBy: 'u-carla',
    createdAt: daysAgo(35),
    updatedAt: daysAgo(2),
    updatedBy: 'u-carla',
    archived: false,
  },
  {
    id: 'p-retro',
    workspaceId: DEMO_WORKSPACE_ID,
    title: 'Retro sprint 12',
    icon: '🔄',
    content: pageContent([
      { type: 'heading', text: 'Qué funcionó' },
      { type: 'text', text: 'Demo semanal, tests de dominio y decisiones documentadas en páginas. El drag & drop quedó muy sólido.' },
      { type: 'heading', text: 'Qué mejorar' },
      { type: 'text', text: 'Menos trabajo en paralelo. Cerrar el alcance antes de abrir nuevas ideas. Más pruebas en móvil.' },
      { type: 'heading', text: 'Acciones' },
      { type: 'check', text: 'Congelar alcance el martes', checked: false },
      { type: 'check', text: 'Sesión de QA móvil el viernes', checked: false },
    ]),
    parentId: null,
    createdBy: 'u-alex',
    createdAt: daysAgo(8),
    updatedAt: daysAgo(7),
    updatedBy: 'u-alex',
    archived: false,
  },
]

const comments: TaskComment[] = [
  {
    id: 'c-1',
    workspaceId: DEMO_WORKSPACE_ID,
    boardId: 'b-producto',
    taskId: 't-3',
    authorId: 'u-ana',
    authorName: 'Ana Torres',
    authorPhotoURL: null,
    body: 'Probado con teclado: se siente muy bien. ¿Añadimos anuncio para lectores de pantalla?',
    createdAt: minutesAgo(80),
  },
  {
    id: 'c-2',
    workspaceId: DEMO_WORKSPACE_ID,
    boardId: 'b-producto',
    taskId: 't-3',
    authorId: 'u-bruno',
    authorName: 'Bruno Vidal',
    authorPhotoURL: null,
    body: 'Sí, uso `aria-live` para anunciar la columna de destino. Lo dejo listo hoy.',
    createdAt: minutesAgo(70),
  },
  {
    id: 'c-3',
    workspaceId: DEMO_WORKSPACE_ID,
    boardId: 'b-producto',
    taskId: 't-1',
    authorId: 'u-alex',
    authorName: 'Alex Rivera',
    authorPhotoURL: null,
    body: 'Mi voto: beta sin notificaciones push, pero con búsqueda global y plantillas de página.',
    createdAt: minutesAgo(40),
  },
]

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]))
}

export function createDemoState(): DemoState {
  return {
    users: indexById(users),
    workspaces: indexById([workspace]),
    members: Object.fromEntries(
      members.map((member) => [`${member.workspaceId}:${member.uid}`, member]),
    ),
    invites: {},
    channels: indexById(channels),
    messages: indexById(messages),
    typing: {},
    reads: {},
    boards: indexById(boards),
    tasks: indexById([...productTasks, ...launchTasks]),
    comments: indexById(comments),
    pages: indexById(pages),
    files: indexById(files),
    folders: indexById(folders),
  }
}

export const DEMO_SEED = {
  users,
  workspace,
  members,
  channels,
  messages,
  boards,
  tasks: [...productTasks, ...launchTasks],
  comments,
  pages,
  files,
  folders,
  emptyPageContent: EMPTY_PAGE_CONTENT,
}
