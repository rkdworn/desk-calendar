import FullCalendar, {
  type CalendarRef,
  type DateClickInfo,
  type EventClickInfo,
  type EventDisplayInfo,
  type EventSourceFuncInfo,
} from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import koLocale from '@fullcalendar/react/locales/ko'
import classicThemePlugin from '@fullcalendar/react/themes/classic'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { findEventColor, randomEventColorId } from '../events/colors.ts'
import { toMeridiemTimeString } from '../events/dates.ts'
import type { EventStore } from '../events/EventStore.ts'
import { newAllDayEvent, toFormValues, type EventFormValues } from '../events/eventForm.ts'
import type { CalendarEvent, NewCalendarEvent } from '../events/types.ts'
import { readableTextOn } from '../settings/appearance.ts'
import { EventDialog } from './EventDialog.tsx'

interface MonthCalendarProps {
  store: EventStore
  // 접힌 상태에서는 날짜 칸이 CSS로 숨겨지므로 높이를 내용(상단 바)에 맞춘다
  collapsed?: boolean
}

// id가 null이면 새 일정
type Editing = { id: string | null; values: EventFormValues }

// 다른 기기(휴대폰, 구글 캘린더 웹)에서 바꾼 일정도 보이도록 이 간격으로 다시 불러온다
const REFRESH_INTERVAL_MS = 5 * 60 * 1000
// 불러오기에 실패했을 때(부팅 직후 인터넷 연결 전 등) 다시 시도하는 간격
const RETRY_DELAY_MS = 30 * 1000

export function MonthCalendar({ store, collapsed = false }: MonthCalendarProps) {
  const calendarRef = useRef<CalendarRef>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  // 실패할 때마다 새 객체라서 같은 오류가 이어져도 아래 재시도 효과가 다시 돈다
  const [loadError, setLoadError] = useState<{ message: string } | null>(null)

  // 함수 참조가 바뀌면 FullCalendar가 이벤트 소스를 새로 받아 다시 불러오므로 고정한다.
  // 저장소가 바뀌면(구글 계정 연결·해제) 그래서 다시 불러온다.
  // 실패하면 FullCalendar는 이미 보이던 일정을 그대로 두고 eventSourceFailure를 부른다.
  const fetchEvents = useCallback(
    async (info: EventSourceFuncInfo) => {
      const events = await store.list({ start: info.start, end: info.end })
      setLoadError(null)
      return events.map(toEventInput)
    },
    [store],
  )

  const refetch = useCallback(() => calendarRef.current?.getApi().refetchEvents(), [])

  useEffect(() => {
    const timer = setInterval(refetch, REFRESH_INTERVAL_MS)
    window.addEventListener('online', refetch)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', refetch)
    }
  }, [refetch])

  useEffect(() => {
    if (!loadError) return
    const timer = setTimeout(refetch, RETRY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [loadError, refetch])

  // 새 일정은 무작위 색으로 시작한다(편집 창에서 바꿀 수 있다)
  function handleDateClick(info: DateClickInfo) {
    const event = { ...newAllDayEvent(info.date), colorId: randomEventColorId() }
    setEditing({ id: null, values: toFormValues(event) })
  }

  function handleEventClick({ event }: EventClickInfo) {
    setEditing({
      id: event.id,
      values: toFormValues({
        title: event.title,
        allDay: event.allDay,
        start: event.startStr,
        end: event.endStr,
        colorId: (event.extendedProps as Pick<CalendarEvent, 'colorId'>).colorId,
      }),
    })
  }

  function finish() {
    setEditing(null)
    refetch()
  }

  async function handleSave(event: NewCalendarEvent) {
    if (editing?.id) {
      await store.update({ ...event, id: editing.id })
    } else {
      await store.create(event)
    }
    finish()
  }

  async function handleDelete() {
    if (!editing?.id) return
    await store.remove(editing.id)
    finish()
  }

  return (
    <>
      <FullCalendar
        ref={calendarRef}
        plugins={[classicThemePlugin, dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ start: 'title', end: 'prev,next' }}
        locale={koLocale}
        events={fetchEvents}
        eventContent={renderEventContent}
        // 기본값(auto)은 하루 안의 시간 일정을 점 + 글씨로 그린다. 종일 일정처럼 색 막대로 통일한다(사용자 요청).
        eventDisplay="block"
        eventSourceFailure={(error: unknown) =>
          setLoadError({ message: error instanceof Error ? error.message : String(error) })
        }
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        height={collapsed ? 'auto' : '100%'}
      />
      {loadError && (
        <div role="alert" className="calendar-load-error">
          <span>일정을 불러오지 못했습니다. {loadError.message}</span>
          <button type="button" onClick={refetch}>
            다시 시도
          </button>
        </div>
      )}
      {editing && (
        <EventDialog
          initial={editing.values}
          isNew={editing.id === null}
          onSave={handleSave}
          onDelete={editing.id === null ? undefined : handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// 색이 있는 일정은 막대를 그 색으로 칠한다. 색이 없으면
// 테마 기본 일정 색(--fc-classic-event, 파랑). colorId는 FullCalendar의 extendedProps로 들어간다.
function toEventInput(event: CalendarEvent) {
  const color = findEventColor(event.colorId)
  return color ? { ...event, color: color.hex, contrastColor: readableTextOn(color.hex) } : event
}

// 일정 칸 내용. FullCalendar 기본 모양은 시간과 제목을 한 줄에 두고 넘치면 잘라 버리므로,
// 시간(시간 일정만, 'AM 9:00')을 첫 줄에 두고 제목은 칸 폭에 맞춰 줄바꿈한다(index.css의 .event-label).
// 시간을 보일지는 FullCalendar의 timeText로 정하고(여러 날 일정은 첫 칸에만) 표기만 바꾼다.
function renderEventContent(info: EventDisplayInfo) {
  const { event } = info
  return (
    <div className="event-label">
      {info.timeText && event.start && (
        <div className="event-label-time">{toMeridiemTimeString(event.start)}</div>
      )}
      <div className="event-label-title">{event.title}</div>
    </div>
  )
}
