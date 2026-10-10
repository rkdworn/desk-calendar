import {
  addDays,
  parseEventDate,
  toDateString,
  toLocalDateTimeString,
  toOffsetDateTimeString,
} from './dates.ts'
import type { NewCalendarEvent } from './types.ts'

// 편집 폼에 보이는 값. 저장 형식(CalendarEvent)과 두 가지가 다르다.
// - 시간 일정의 start/end는 <input type="datetime-local"> 형식('YYYY-MM-DDTHH:mm')
// - 종일 일정의 end는 사용자가 보는 그대로의 마지막 날(포함). 저장할 때 하루 더해 배타적으로 바꾼다.
export interface EventFormValues {
  title: string
  allDay: boolean
  start: string
  end: string
  colorId?: string
}

export type FormResult = { ok: true; event: NewCalendarEvent } | { ok: false; error: string }

const DEFAULT_START_TIME = '09:00'
const DEFAULT_END_TIME = '10:00'

export function toFormValues(event: NewCalendarEvent): EventFormValues {
  if (event.allDay) {
    return {
      title: event.title,
      allDay: true,
      start: event.start,
      end: addDays(event.end, -1),
      colorId: event.colorId,
    }
  }
  return {
    title: event.title,
    allDay: false,
    colorId: event.colorId,
    start: toLocalDateTimeString(parseEventDate(event.start)),
    end: toLocalDateTimeString(parseEventDate(event.end)),
  }
}

export function fromFormValues(values: EventFormValues): FormResult {
  const title = values.title.trim()
  if (!title) return { ok: false, error: '제목을 입력하세요.' }
  if (!values.start || !values.end) return { ok: false, error: '시작과 종료를 입력하세요.' }

  if (values.allDay) {
    if (values.end < values.start) {
      return { ok: false, error: '종료일이 시작일보다 앞설 수 없습니다.' }
    }
    return {
      ok: true,
      event: {
        title,
        allDay: true,
        start: values.start,
        end: addDays(values.end, 1),
        colorId: values.colorId,
      },
    }
  }

  const start = new Date(values.start)
  const end = new Date(values.end)
  if (end <= start) return { ok: false, error: '종료 시각은 시작 시각보다 뒤여야 합니다.' }
  return {
    ok: true,
    event: {
      title,
      allDay: false,
      start: toOffsetDateTimeString(start),
      end: toOffsetDateTimeString(end),
      colorId: values.colorId,
    },
  }
}

// 종일 ↔ 시간 일정 전환 시 날짜는 유지하고 형식만 바꾼다.
export function setAllDay(values: EventFormValues, allDay: boolean): EventFormValues {
  if (values.allDay === allDay) return values
  if (allDay) {
    return {
      ...values,
      allDay: true,
      start: values.start.slice(0, 10),
      end: values.end.slice(0, 10),
    }
  }
  return {
    ...values,
    allDay: false,
    start: `${values.start}T${DEFAULT_START_TIME}`,
    end: `${values.end}T${DEFAULT_END_TIME}`,
  }
}

// 날짜 칸을 클릭했을 때 새 일정의 초기값
export function newAllDayEvent(date: Date): NewCalendarEvent {
  const start = toDateString(date)
  return { title: '', allDay: true, start, end: addDays(start, 1) }
}
