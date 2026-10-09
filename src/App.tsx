import { MonthCalendar } from './components/MonthCalendar.tsx'
import { LocalStorageEventStore } from './events/LocalStorageEventStore.ts'

// 2단계에서 Google Calendar 구현으로 교체하는 지점
const store = new LocalStorageEventStore()

function App() {
  return <MonthCalendar store={store} />
}

export default App
