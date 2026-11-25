import { DndContext } from '@dnd-kit/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '@/domain/entities/kanban'
import { KanbanColumn } from './kanban-column'

vi.mock('./task-card', () => ({ TaskCard: ({ task }: { task: Task }) => <div>{task.title}</div> }))

describe('búsqueda por columna', () => {
  it('filtra solo las tareas de la columna y permite limpiar la búsqueda', () => {
    const base: Task = {
      id: 'a', workspaceId: 'ws', boardId: 'board', title: 'Diseñar interfaz',
      description: '', labels: [], priority: 'high', columnId: 'todo', order: 0,
      assigneeIds: [], reviewerId: null, dependsOnTaskIds: [], dueDate: null,
      attachmentIds: [], createdBy: 'user', createdAt: '', updatedAt: '', completedAt: null,
    }
    const tasks: Task[] = [base, { ...base, id: 'b', title: 'Revisar archivo', priority: 'low' }]
    render(<DndContext><KanbanColumn
      column={{ id: 'todo', name: 'Por hacer', color: '#aaa', isDone: false }}
      tasks={tasks}
      tasksById={new Map(tasks.map((task) => [task.id, task]))}
      members={[]}
      onOpenTask={() => {}}
      onCreateTask={() => {}}
    /></DndContext>)
    fireEvent.click(screen.getByRole('button', { name: 'Buscar tareas en Por hacer' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar tareas en Por hacer' }), { target: { value: 'archivo' } })
    expect(screen.queryByText('Diseñar interfaz')).toBeNull()
    expect(screen.getByText('Revisar archivo')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    expect(screen.getByText('Diseñar interfaz')).toBeTruthy()
  })
})
