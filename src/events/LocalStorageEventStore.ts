import type { EventStore } from './EventStore.ts'
import type { CalendarEvent, DateRange, NewCalendarEvent } from './types.ts'

const STORAGE_KEY = 'desk-calendar:events'

export class LocalStorageEventStore implements EventStore {
  async list(range: DateRange): Promise<CalendarEvent[]> {
    return this.read().filter(
      (event) => toDate(event.start) < range.end && toDate(event.end) > range.start,
    )
  }

  async create(input: NewCalendarEvent): Promise<CalendarEvent> {
    const event = { ...input, id: crypto.randomUUID() }
    this.write([...this.read(), event])
    return event
  }

  async update(event: CalendarEvent): Promise<CalendarEvent> {
    const events = this.read()
    if (!events.some((e) => e.id === event.id)) {
      throw new Error(`Event not found: ${event.id}`)
    }
    this.write(events.map((e) => (e.id === event.id ? event : e)))
    return event
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((e) => e.id !== id))
  }

  private read(): CalendarEvent[] {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CalendarEvent[]) : []
  }

  private write(events: CalendarEvent[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  }
}

// 'YYYY-MM-DD'만 있는 문자열은 Date가 UTC 자정으로 해석하므로 로컬 자정으로 맞춘다.
function toDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
}
