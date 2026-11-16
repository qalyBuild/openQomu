export interface PageTemplate {
  id: string
  name: string
  description: string
  icon: string
  title: string
  content: string
}

type Block =
  | { kind: 'h1' | 'h2' | 'p' | 'quote'; text: string }
  | { kind: 'check'; text: string; checked?: boolean }

function textNode(text: string) {
  return { type: 'text', text }
}

function doc(blocks: Block[]): string {
  return JSON.stringify({
    type: 'doc',
    content: blocks.map((block) => {
      if (block.kind === 'h1' || block.kind === 'h2') {
        return {
          type: 'heading',
          attrs: { level: block.kind === 'h1' ? 1 : 2 },
          content: [textNode(block.text)],
        }
      }
      if (block.kind === 'quote') {
        return {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [textNode(block.text)] }],
        }
      }
      if (block.kind === 'check') {
        return {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: block.checked ?? false },
              content: [{ type: 'paragraph', content: [textNode(block.text)] }],
            },
          ],
        }
      }
      return { type: 'paragraph', content: [textNode(block.text)] }
    }),
  })
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'blank',
    name: 'Página en blanco',
    description: 'Empieza con un lienzo limpio.',
    icon: '📄',
    title: 'Sin título',
    content: doc([{ kind: 'p', text: '' }]),
  },
  {
    id: 'meeting',
    name: 'Acta de reunión',
    description: 'Objetivo, asistentes, decisiones y acciones.',
    icon: '🗓️',
    title: 'Reunión de equipo',
    content: doc([
      { kind: 'h1', text: 'Reunión de equipo' },
      { kind: 'h2', text: 'Objetivo' },
      { kind: 'p', text: '¿Qué queremos resolver hoy?' },
      { kind: 'h2', text: 'Asistentes' },
      { kind: 'p', text: 'Añade aquí a las personas participantes.' },
      { kind: 'h2', text: 'Decisiones' },
      { kind: 'p', text: 'Documenta las decisiones y su contexto.' },
      { kind: 'h2', text: 'Acciones' },
      { kind: 'check', text: 'Definir responsable y fecha' },
      { kind: 'check', text: 'Compartir conclusiones en el canal' },
    ]),
  },
  {
    id: 'brief',
    name: 'Brief de producto',
    description: 'Contexto, problema, propuesta y métricas.',
    icon: '🎯',
    title: 'Brief de producto',
    content: doc([
      { kind: 'h1', text: 'Brief de producto' },
      { kind: 'h2', text: 'Contexto' },
      { kind: 'p', text: '¿Por qué ahora? Resume el contexto y las señales que lo motivan.' },
      { kind: 'h2', text: 'Problema' },
      { kind: 'p', text: 'Describe el problema del usuario con evidencias.' },
      { kind: 'h2', text: 'Propuesta' },
      { kind: 'p', text: 'La solución en una frase. Después, el detalle.' },
      { kind: 'h2', text: 'Métricas de éxito' },
      { kind: 'check', text: 'Métrica principal' },
      { kind: 'check', text: 'Métrica de guardia' },
    ]),
  },
  {
    id: 'retro',
    name: 'Retrospectiva',
    description: 'Qué funcionó, qué mejorar y acciones.',
    icon: '🔄',
    title: 'Retrospectiva',
    content: doc([
      { kind: 'h1', text: 'Retrospectiva' },
      { kind: 'h2', text: 'Qué funcionó' },
      { kind: 'p', text: 'Celebra lo que salió bien.' },
      { kind: 'h2', text: 'Qué mejorar' },
      { kind: 'p', text: 'Sé específico y generoso.' },
      { kind: 'h2', text: 'Acciones' },
      { kind: 'check', text: 'Acción con responsable' },
      { kind: 'check', text: 'Revisar en la próxima retro' },
    ]),
  },
]
