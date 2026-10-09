import type { CalendarEvent, DateRange, NewCalendarEvent } from './types.ts'

// 일정 저장소 경계. 지금은 localStorage, 구글 연동 단계에서 Google Calendar 구현으로 교체한다.
// UI는 이 인터페이스만 알아야 한다.
export interface EventStore {
  list(range: DateRange): Promise<CalendarEvent[]>
  create(event: NewCalendarEvent): Promise<CalendarEvent>
  update(event: CalendarEvent): Promise<CalendarEvent>
  remove(id: string): Promise<void>
}
