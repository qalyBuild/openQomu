import type { PushOutbox } from '@/domain/ports'
import type { PushEvent } from '@/domain/entities/push'

/** Outbox en memoria; útil para demo y tests. */
export class DemoPushOutbox implements PushOutbox {
  readonly events: PushEvent[] = []

  async enqueue(event: PushEvent): Promise<string> {
    const id = `outbox-${this.events.length + 1}`
    this.events.push({ ...event, id })
    return id
  }

  async dispatch(): Promise<void> {
    // En demo no hay Worker al que entregar.
  }
}
