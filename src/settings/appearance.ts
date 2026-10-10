// 캘린더 외관 설정. 설정 창에서 바꾸고 캘린더 창에 적용한다(두 창이 같은 localStorage를 쓴다).

export interface Appearance {
  /** 캘린더 판 배경의 불투명도, 0~1 */
  opacity: number
  /** 일정 막대 배경의 불투명도, 0~1. 글씨는 그대로 둔다. */
  eventOpacity: number
  /** '#rrggbb' */
  background: string
  text: string
  today: string
}

export const DEFAULT_APPEARANCE: Appearance = {
  opacity: 0.72,
  eventOpacity: 1,
  background: '#ffffff',
  text: '#030712',
  today: '#facc15',
}

const STORAGE_KEY = 'desk-calendar:appearance'

// 오늘 칸은 고른 색을 그대로 칠하면 칸 안의 글씨와 일정이 묻혀서 이 비율로 섞는다
const TODAY_ALPHA = 0.3

export function loadAppearance(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Appearance> | null
    return { ...DEFAULT_APPEARANCE, ...saved }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function saveAppearance(appearance: Appearance): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
}

/** CSS 변수로 적용한다. FullCalendar classic 테마 변수와 index.css의 --surface-background를 쓴다. */
export function applyAppearance(appearance: Appearance): void {
  const style = document.documentElement.style
  style.setProperty('--surface-background', withAlpha(appearance.background, appearance.opacity))
  style.setProperty('--event-opacity', String(appearance.eventOpacity))
  style.setProperty('--fc-classic-foreground', appearance.text)
  style.setProperty('--fc-classic-muted-foreground', withAlpha(appearance.text, 0.65))
  style.setProperty('--fc-classic-faint-foreground', withAlpha(appearance.text, 0.45))
  style.setProperty('--fc-classic-today', withAlpha(appearance.today, TODAY_ALPHA))
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** 배경색 위에서 읽기 쉬운 글씨색(흰색 또는 거의 검정) */
export function readableTextOn(hex: string): string {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.4 ? '#111827' : '#ffffff'
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
