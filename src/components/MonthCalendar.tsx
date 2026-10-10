import FullCalendar, {
  type CalendarRef,
  type DateClickInfo,
  type EventClickInfo,
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
import type { EventStore } from '../events/EventStore.ts'
import { newAllDayEvent, toFormValues, type EventFormValues } from '../events/eventForm.ts'
import type { NewCalendarEvent } from '../events/types.ts'
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
      return events
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

  function handleDateClick(info: DateClickInfo) {
    setEditing({ id: null, values: toFormValues(newAllDayEvent(info.date)) })
  }

  function handleEventClick({ event }: EventClickInfo) {
    setEditing({
      id: event.id,
      values: toFormValues({
        title: event.title,
        allDay: event.allDay,
        start: event.startStr,
        end: event.endStr,
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
