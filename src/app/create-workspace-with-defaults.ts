import type { AppContainer, SessionUser } from '@/domain/ports'
import type { Workspace } from '@/domain/entities/identity'
import type { Board } from '@/domain/entities/kanban'
import { DEFAULT_CHANNELS } from '@/domain/entities/chat'
import { DEFAULT_BOARD_COLUMNS } from '@/domain/entities/kanban'

function welcomeContent(workspaceName: string): string {
  const paragraph = (text: string) => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  })
  const heading = (text: string) => ({
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text }],
  })
  const check = (text: string, checked = false) => ({
    type: 'taskList',
    content: [
      {
        type: 'taskItem',
        attrs: { checked },
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      },
    ],
  })
  return JSON.stringify({
    type: 'doc',
    content: [
      heading(`Bienvenido a ${workspaceName} 👋`),
      paragraph(
        'Este es tu espacio para conversar, organizar el trabajo y documentar lo importante. Aquí tienes tres formas de empezar.',
      ),
      heading('Conversa'),
      paragraph(
        'Entra en #general y preséntate. Menciona a alguien con @ para llamar su atención y reacciona con emojis.',
      ),
      heading('Organiza'),
      paragraph(
        'Abre el tablero, crea una tarea, asígnala y arrástrala entre columnas. Todo se sincroniza al instante.',
      ),
      heading('Documenta'),
      paragraph(
        'Crea páginas para decisiones, briefs o actas. Se guardan automáticamente y puedes anidarlas.',
      ),
      heading('Primeros pasos'),
      check('Invitar a tu equipo', false),
      check('Escribir el primer mensaje', false),
      check('Completar una tarea', false),
    ],
  })
}

export interface CreateWorkspaceSetupResult {
  workspace: Workspace
  board: Board | null
}

/**
 * Caso de uso de onboarding: crea el workspace y lo deja listo para usar
 * (canales, tablero, tareas iniciales y página de bienvenida).
 */
export async function createWorkspaceWithDefaults(
  container: AppContainer,
  user: SessionUser,
  input: { name: string; icon: string; description: string },
): Promise<CreateWorkspaceSetupResult> {
  const workspace = await container.workspaces.create({
    name: input.name,
    icon: input.icon,
    description: input.description,
    owner: user,
  })

  await Promise.allSettled(
    DEFAULT_CHANNELS.map((channel) =>
      container.channels.create({
        workspaceId: workspace.id,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        createdBy: user.id,
      }),
    ),
  )

  let board: Board | null = null
  try {
    board = await container.boards.create({
      workspaceId: workspace.id,
      name: 'Mi primer tablero',
      description: 'Organiza el trabajo del equipo y sigue el avance.',
      createdBy: user.id,
      columns: DEFAULT_BOARD_COLUMNS,
    })
    await Promise.allSettled([
      container.tasks.create({
        workspaceId: workspace.id,
        boardId: board.id,
        title: 'Invitar a tu equipo',
        description: 'Comparte un enlace de invitación desde la barra superior.',
        columnId: 'todo',
        priority: 'high',
        assigneeIds: [user.id],
        labels: ['equipo'],
        createdBy: user.id,
      }),
      container.tasks.create({
        workspaceId: workspace.id,
        boardId: board.id,
        title: 'Escribir en #general',
        description: 'Preséntate y comparte en qué estáis trabajando.',
        columnId: 'todo',
        priority: 'medium',
        assigneeIds: [user.id],
        createdBy: user.id,
      }),
      container.tasks.create({
        workspaceId: workspace.id,
        boardId: board.id,
        title: 'Explorar la página de bienvenida',
        description: 'Encontrarás atajos y buenas prácticas.',
        columnId: 'doing',
        priority: 'low',
        createdBy: user.id,
      }),
    ])
  } catch (error) {
    console.error('[openqomu] no se pudo crear el tablero inicial', error)
  }

  try {
    await container.pages.create({
      workspaceId: workspace.id,
      title: `Bienvenido a ${workspace.name}`,
      icon: '👋',
      content: welcomeContent(workspace.name),
      createdBy: user.id,
    })
  } catch (error) {
    console.error('[openqomu] no se pudo crear la página inicial', error)
  }

  return { workspace, board }
}
