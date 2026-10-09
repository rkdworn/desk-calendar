const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

const pad = (n: number) => String(n).padStart(2, '0')

// 'YYYY-MM-DD'만 있는 문자열은 Date가 UTC 자정으로 해석하므로 로컬 자정으로 맞춘다.
export function parseEventDate(value: string): Date {
  return DATE_ONLY.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
}

// 로컬 기준 'YYYY-MM-DD'
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// <input type="datetime-local"> 값 형식인 로컬 기준 'YYYY-MM-DDTHH:mm'
export function toLocalDateTimeString(d: Date): string {
  return `${toDateString(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 로컬 시간대 오프셋을 붙인 ISO 8601. 예: '2026-10-15T14:00:00+09:00'
export function toOffsetDateTimeString(d: Date): string {
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${toLocalDateTimeString(d)}:${pad(d.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

export function addDays(date: string, days: number): string {
  const d = parseEventDate(date)
  d.setDate(d.getDate() + days)
  return toDateString(d)
}
