import FullCalendar, { type EventSourceFuncInfo } from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import koLocale from '@fullcalendar/react/locales/ko'
import classicThemePlugin from '@fullcalendar/react/themes/classic'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import { useCallback } from 'react'
import type { EventStore } from '../events/EventStore.ts'

interface MonthCalendarProps {
  store: EventStore
}

export function MonthCalendar({ store }: MonthCalendarProps) {
  // 함수 참조가 바뀌면 FullCalendar가 이벤트 소스를 새로 받아 다시 불러오므로 고정한다.
  const fetchEvents = useCallback(
    (info: EventSourceFuncInfo) => store.list({ start: info.start, end: info.end }),
    [store],
  )

  return (
    <FullCalendar
      plugins={[classicThemePlugin, dayGridPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{ start: 'title', end: 'today prev,next' }}
      locale={koLocale}
      events={fetchEvents}
      height="100%"
    />
  )
}
