import type { EventStore } from './EventStore.ts'
import type { CalendarEvent, DateRange, NewCalendarEvent } from './types.ts'

// 지금은 구글 계정의 기본 캘린더 하나만 쓴다
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

// Google Calendar API에 쓸 access token을 준다. rejected는 API가 401로 거절한 토큰이다(새로 받아야 함).
// Tauri에서는 Rust 쪽(src-tauri/src/google.rs)이 토큰을 관리한다.
export type AccessTokenProvider = (rejected?: string) => Promise<string>

// Google Calendar API 이벤트 중 이 앱이 쓰는 부분. 종일 일정은 date, 시간 일정은 dateTime이 있다.
interface GoogleEventTime {
  date?: string | null
  dateTime?: string | null
}

interface GoogleEvent {
  id: string
  summary?: string
  status?: string
  start: GoogleEventTime
  end: GoogleEventTime
}

interface GoogleEventPage {
  items: GoogleEvent[]
  nextPageToken?: string
}

export class GoogleApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GoogleApiError'
    this.status = status
  }
}

const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

export class GoogleCalendarEventStore implements EventStore {
  private readonly accessToken: AccessTokenProvider

  constructor(accessToken: AccessTokenProvider) {
    this.accessToken = accessToken
  }

  async list(range: DateRange): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({
        timeMin: range.start.toISOString(),
        timeMax: range.end.toISOString(),
        // 반복 일정을 날짜별 일정으로 펼쳐 받는다. 그중 하나를 고치거나 지우면 그 날짜만 바뀐다.
        singleEvents: 'true',
        maxResults: '2500',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const page = await this.request<GoogleEventPage>(`?${params}`)
      for (const item of page.items) {
        if (item.status !== 'cancelled') events.push(fromGoogle(item))
      }
      pageToken = page.nextPageToken
    } while (pageToken)
    return events
  }

  async create(event: NewCalendarEvent): Promise<CalendarEvent> {
    return fromGoogle(await this.request<GoogleEvent>('', 'POST', toGoogle(event, false)))
  }

  // PATCH라서 이 앱이 다루지 않는 필드(설명, 장소, 알림, 참석자 등)는 구글에 그대로 남는다
  async update(event: CalendarEvent): Promise<CalendarEvent> {
    return fromGoogle(await this.request<GoogleEvent>(eventPath(event.id), 'PATCH', toGoogle(event, true)))
  }

  async remove(id: string): Promise<void> {
    try {
      await this.request(eventPath(id), 'DELETE')
    } catch (e) {
      // 410: 다른 곳에서 이미 삭제됨
      if (!(e instanceof GoogleApiError && e.status === 410)) throw e
    }
  }

  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let token = await this.accessToken()
    let response = await send(path, method, body, token)
    if (response.status === 401) {
      token = await this.accessToken(token)
      response = await send(path, method, body, token)
    }
    if (!response.ok) throw await toError(response)
    return (response.status === 204 ? undefined : await response.json()) as T
  }
}

function eventPath(id: string): string {
  return `/${encodeURIComponent(id)}`
}

async function send(path: string, method: string, body: unknown, token: string): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  try {
    return await fetch(EVENTS_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // 웹뷰(WebView2)가 일정 응답을 PC의 HTTP 캐시 폴더에 복사해 두지 않게 한다(개인정보).
      // 어차피 주기적으로 새로 받으므로 캐시가 없어도 느려지지 않는다.
      cache: 'no-store',
    })
  } catch {
    throw new Error('구글 캘린더에 연결하지 못했습니다. 인터넷 연결을 확인하세요.')
  }
}

async function toError(response: Response): Promise<GoogleApiError> {
  let detail = response.statusText
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    detail = body.error?.message ?? detail
  } catch {
    // JSON이 아닌 응답이면 상태 문구만 쓴다
  }
  const message =
    response.status === 403
      ? `구글 캘린더가 요청을 거절했습니다(권한 없음): ${detail}`
      : response.status === 404
        ? '구글 캘린더에서 이 일정을 찾을 수 없습니다. 다른 곳에서 삭제되었을 수 있습니다.'
        : `구글 캘린더 오류(${response.status}): ${detail}`
  return new GoogleApiError(response.status, message)
}

function fromGoogle(event: GoogleEvent): CalendarEvent {
  const allDay = Boolean(event.start.date)
  const time = (t: GoogleEventTime) => (allDay ? t.date : t.dateTime) ?? ''
  return {
    id: event.id,
    title: event.summary ?? '(제목 없음)',
    allDay,
    start: time(event.start),
    end: time(event.end),
  }
}

// 우리 날짜 형식은 구글의 date/dateTime과 같아서 그대로 넣는다(types.ts).
// 시간 일정은 오프셋이 붙은 dateTime만으로도 정확하지만, 구글 캘린더에서 일정의 시간대가
// 이 PC의 시간대로 보이도록 timeZone도 넣는다.
function toGoogle(event: NewCalendarEvent, patch: boolean) {
  const time = (value: string) => ({
    // PATCH는 넘긴 필드만 바꾸므로, 종일 ↔ 시간 일정을 바꿀 때 이전 형식의 필드를 null로 지운다
    ...(patch ? { date: null, dateTime: null, timeZone: null } : {}),
    ...(event.allDay ? { date: value } : { dateTime: value, timeZone: localTimeZone }),
  })
  return { summary: event.title, start: time(event.start), end: time(event.end) }
}
