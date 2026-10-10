import { useRef } from 'react'
import { MonthCalendar } from './components/MonthCalendar.tsx'
import { useCollapse } from './components/useCollapse.ts'
import { useGoogleConnected } from './components/useGoogleConnected.ts'
import { WindowHandles } from './components/WindowHandles.tsx'
import type { EventStore } from './events/EventStore.ts'
import { GoogleCalendarEventStore } from './events/GoogleCalendarEventStore.ts'
import { LocalStorageEventStore } from './events/LocalStorageEventStore.ts'
import { google, inTauri } from './platform/tauri.ts'

// 구글 계정이 연결되어 있으면 구글 캘린더, 아니면(일반 브라우저 포함) 이 PC의 localStorage.
// 연결 전에 넣은 로컬 일정은 옮기지 않고 그대로 둔다. 연결을 끊으면 다시 보인다.
const localStore = new LocalStorageEventStore()
const googleStore = new GoogleCalendarEventStore(google.accessToken)

// 연결 여부를 확인하는 잠깐 동안 쓰는 빈 저장소. 로컬 일정이 잠깐 보였다 사라지지 않게 한다.
// (캘린더를 아예 늦게 그리면 접힌 상태로 시작할 때 useCollapse가 빈 화면의 높이를 잰다)
const pendingStore: EventStore = {
  list: async () => [],
  create: notReady,
  update: notReady,
  remove: notReady,
}

async function notReady(): Promise<never> {
  throw new Error('구글 연결 상태를 확인하는 중입니다. 잠시 후 다시 시도하세요.')
}

function App() {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const { collapsed, toggle } = useCollapse(surfaceRef)
  const googleConnected = useGoogleConnected()
  const store = googleConnected === null ? pendingStore : googleConnected ? googleStore : localStore

  return (
    <div ref={surfaceRef} className="calendar-surface">
      {inTauri && <WindowHandles collapsed={collapsed} onToggleCollapsed={toggle} />}
      <MonthCalendar store={store} collapsed={collapsed} />
    </div>
  )
}

export default App
