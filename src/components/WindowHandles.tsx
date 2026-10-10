import type { MouseEvent, PointerEvent } from 'react'
import { resizeTo, startMoving } from '../platform/tauri.ts'
import './WindowHandles.css'

const MIN_WIDTH = 480
const MIN_HEIGHT = 360

interface WindowHandlesProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

// 바탕화면에 붙은 창은 제목 표시줄이 없으므로 이동·크기 조절 손잡이와 접기 버튼을 따로 둔다.
// 손잡이는 마우스를 창 위에 올렸을 때만 보인다.
export function WindowHandles({ collapsed, onToggleCollapsed }: WindowHandlesProps) {
  function handleMoveStart(e: MouseEvent) {
    if (e.button === 0) startMoving()
  }

  function handleResizeStart(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const start = { x: e.screenX, y: e.screenY, width: window.innerWidth, height: window.innerHeight }
    let frame = 0

    const onMove = (ev: globalThis.PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() =>
        resizeTo(
          Math.max(MIN_WIDTH, start.width + ev.screenX - start.x),
          Math.max(MIN_HEIGHT, start.height + ev.screenY - start.y),
        ),
      )
    }
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('lostpointercapture', onEnd)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('lostpointercapture', onEnd)
  }

  return (
    <>
      <div
        className="window-handle window-handle-move"
        onMouseDown={handleMoveStart}
        title="드래그해서 이동"
      />
      <button
        type="button"
        className="window-hide-button"
        onClick={onToggleCollapsed}
        title={collapsed ? '날짜 칸 펼치기' : '날짜 칸 숨기기 (상단 바만 남김)'}
      >
        {collapsed ? '펼치기' : '숨기기'}
      </button>
      {!collapsed && (
        <div
          className="window-handle window-handle-resize"
          onPointerDown={handleResizeStart}
          title="드래그해서 크기 조절"
        />
      )}
    </>
  )
}
