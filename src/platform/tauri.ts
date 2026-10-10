import { isTauri } from '@tauri-apps/api/core'
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
