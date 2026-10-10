// 일정 색. Google Calendar의 일정 색 11가지(colorId '1'~'11')와 같아서, 여기서 고른 색이 구글
// 캘린더에서도 같은 색으로 보인다. 구글 일정은 임의의 색을 가질 수 없고 이 중 하나이거나, 색을
// 지정하지 않으면(colorId 없음) 캘린더 기본색이다. 이 앱에서는 색 없는 일정(구글 캘린더에서 색 없이 만든
// 일정, 예전 로컬 일정)을 FullCalendar 테마 기본색(--fc-classic-event, 파랑)으로 그린다. 기본색은 바꿀 수 없다.
// 이 앱에서 만드는 새 일정은 늘 무작위 색으로 시작한다.
export interface EventColor {
  id: string
  name: string
  hex: string
}

// 구글 캘린더 색 선택 화면과 같은 순서, 이름은 영어판 구글 캘린더의 이름(사용자 요청)
export const EVENT_COLORS: readonly EventColor[] = [
  { id: '11', name: 'Tomato', hex: '#d50000' },
  { id: '4', name: 'Flamingo', hex: '#e67c73' },
  { id: '6', name: 'Tangerine', hex: '#f4511e' },
  { id: '5', name: 'Banana', hex: '#f6bf26' },
  { id: '2', name: 'Sage', hex: '#33b679' },
  { id: '10', name: 'Basil', hex: '#0b8043' },
  { id: '7', name: 'Peacock', hex: '#039be5' },
  { id: '9', name: 'Blueberry', hex: '#3f51b5' },
  { id: '1', name: 'Lavender', hex: '#7986cb' },
  { id: '3', name: 'Grape', hex: '#8e24aa' },
  { id: '8', name: 'Graphite', hex: '#616161' },
]

export function findEventColor(id: string | undefined): EventColor | undefined {
  return id === undefined ? undefined : EVENT_COLORS.find((c) => c.id === id)
}

// 새 일정에 붙이는 무작위 색
export function randomEventColorId(): string {
  return EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)].id
}
