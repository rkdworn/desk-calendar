import { invoke, isTauri } from '@tauri-apps/api/core'
import { PhysicalSize } from '@tauri-apps/api/dpi'
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import type { Appearance } from '../settings/appearance.ts'

// Tauri 전용 기능은 이 파일에서만 부른다. 일반 브라우저(npm run dev, E2E 테스트)에서는
// inTauri가 false라서 호출되지 않는다.
export const inTauri = isTauri()

export function startMoving(): void {
  void getCurrentWindow().startDragging()
}

// 폭은 지금 물리 픽셀 그대로 두고 높이만 바꾼다(CSS→물리 픽셀 반올림으로 폭이 조금씩 변하지
// 않게). 인자는 CSS 픽셀.
export async function resizeHeight(height: number): Promise<void> {
  const win = getCurrentWindow()
  const { width } = await win.innerSize()
  await win.setSize(new PhysicalSize(width, Math.round(height * window.devicePixelRatio)))
}

// 오른쪽 아래 손잡이용. 드래그 중 계속 불러 크기를 직접 지정한다. 인자는 CSS 픽셀.
// (창 가장자리 크기 조절은 Tauri가 OS 기능으로 따로 처리한다)
export function resizeTo(width: number, height: number): void {
  const ratio = window.devicePixelRatio
  void getCurrentWindow().setSize(
    new PhysicalSize(Math.round(width * ratio), Math.round(height * ratio)),
  )
}

// 설정 창 → 캘린더 창으로 외관 변경을 바로 알린다. 저장은 localStorage(appearance.ts)가 한다.
const APPEARANCE_EVENT = 'appearance-changed'

export function broadcastAppearance(appearance: Appearance): void {
  void emit(APPEARANCE_EVENT, appearance)
}

export function onAppearanceChanged(handler: (appearance: Appearance) => void): Promise<UnlistenFn> {
  return listen<Appearance>(APPEARANCE_EVENT, (event) => handler(event.payload))
}

// Windows 시작 시 자동 실행(HKCU Run 레지스트리, tauri-plugin-autostart).
// 개발 모드 실행 파일은 Vite 개발 서버 없이는 빈 창이므로 등록하지 않는다.
export const autostartAvailable = !import.meta.env.DEV

export const autostart = {
  isEnabled: (): Promise<boolean> => isEnabled(),
  set: (on: boolean): Promise<void> => (on ? enable() : disable()),
}

// 구글 계정 연결. OAuth와 토큰 저장은 Rust(src-tauri/src/google.rs)가 하고, 웹은 access token만 받는다.

// Rust의 AuthError가 invoke 실패 값으로 이 모양으로 온다
export type GoogleAuthError =
  | { kind: 'notConfigured' }
  | { kind: 'notSignedIn' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string }

export interface GoogleStatus {
  // 이 빌드에 OAuth 클라이언트(google-oauth.json)가 들어 있는지
  configured: boolean
  connected: boolean
}

function isGoogleAuthError(e: unknown): e is GoogleAuthError {
  return typeof e === 'object' && e !== null && 'kind' in e
}

export function isSignInCancelled(e: unknown): boolean {
  return isGoogleAuthError(e) && e.kind === 'cancelled'
}

export function describeGoogleError(e: unknown): string {
  if (!isGoogleAuthError(e)) return e instanceof Error ? e.message : String(e)
  switch (e.kind) {
    case 'notConfigured':
      return '구글 OAuth 클라이언트 없이 빌드된 앱입니다(src-tauri/google-oauth.json).'
    case 'notSignedIn':
      return '구글 계정 연결이 끊겼습니다. 설정에서 다시 연결해 주세요.'
    case 'cancelled':
      return '구글 로그인을 취소했습니다.'
    case 'failed':
      return e.message
  }
}

export const google = {
  status: (): Promise<GoogleStatus> => invoke('google_status'),
  // 시스템 브라우저를 열고, 로그인이 끝나거나 실패·취소될 때까지 기다린다
  signIn: (): Promise<void> => invoke('google_sign_in'),
  cancelSignIn: (): Promise<void> => invoke('google_cancel_sign_in'),
  signOut: (): Promise<void> => invoke('google_sign_out'),
  // GoogleCalendarEventStore의 AccessTokenProvider
  accessToken: (rejected?: string): Promise<string> =>
    invoke<string>('google_access_token', { rejected }).catch((e: unknown) => {
      throw new Error(describeGoogleError(e))
    }),
}

// 연결·해제(다른 창에서 한 것 포함)와, 구글 쪽에서 연결이 끊긴 것을 알게 됐을 때 온다
export function onGoogleAuthChanged(handler: (connected: boolean) => void): Promise<UnlistenFn> {
  return listen<boolean>('google-auth-changed', (event) => handler(event.payload))
}
