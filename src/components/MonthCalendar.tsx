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
import { useCallback, useRef, useState } from 'react'
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

export function MonthCalendar({ store, collapsed = false }: MonthCalendarProps) {
  const calendarRef = useRef<CalendarRef>(null)
  const [editing, setEditing] = useState<Editing | null>(null)

  // 함수 참조가 바뀌면 FullCalendar가 이벤트 소스를 새로 받아 다시 불러오므로 고정한다.
  const fetchEvents = useCallback(
    (info: EventSourceFuncInfo) => store.list({ start: info.start, end: info.end }),
    [store],
  )

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
    calendarRef.current?.getApi().refetchEvents()
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
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        height={collapsed ? 'auto' : '100%'}
      />
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
