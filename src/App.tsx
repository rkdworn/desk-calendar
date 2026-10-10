import { useRef } from 'react'
import { MonthCalendar } from './components/MonthCalendar.tsx'
import { useCollapse } from './components/useCollapse.ts'
import { WindowHandles } from './components/WindowHandles.tsx'
import { LocalStorageEventStore } from './events/LocalStorageEventStore.ts'
import { inTauri } from './platform/tauri.ts'

// 구글 연동 단계에서 Google Calendar 구현으로 교체하는 지점
const store = new LocalStorageEventStore()

function App() {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const { collapsed, toggle } = useCollapse(surfaceRef)

  return (
    <div ref={surfaceRef} className="calendar-surface">
      {inTauri && <WindowHandles collapsed={collapsed} onToggleCollapsed={toggle} />}
      <MonthCalendar store={store} collapsed={collapsed} />
    </div>
  )
}

export default App
