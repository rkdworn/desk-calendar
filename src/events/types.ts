// FullCalendar EventInput과 Google Calendar 이벤트 양쪽으로 바로 옮길 수 있는 모양.
// allDay면 start/end는 'YYYY-MM-DD', 아니면 ISO 8601 날짜+시간 문자열.
// end는 배타적(exclusive)이다. 10월 10일 하루짜리 종일 일정은 end가 '2026-10-11'.
export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
}

export type NewCalendarEvent = Omit<CalendarEvent, 'id'>

export interface DateRange {
  start: Date
  end: Date
}
