import type { MouseEvent, PointerEvent } from 'react'
import { beginResize, resizeFromCorner, startMoving, type ResizeCorner } from '../platform/tauri.ts'
import './WindowHandles.css'

const MIN_WIDTH = 480
const MIN_HEIGHT = 360

interface WindowHandlesProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

// 바탕화면에 붙은 창은 제목 표시줄이 없으므로 이동·크기 조절 손잡이와 접기 버튼을 따로 둔다.
// 손잡이는 마우스를 창 위에 올렸을 때만 보인다. 크기 조절은 왼쪽 위·오른쪽 아래 모서리 손잡이로만
// 한다(창 가장자리 크기 조절은 막아 두었다).
export function WindowHandles({ collapsed, onToggleCollapsed }: WindowHandlesProps) {
  function handleMoveStart(e: MouseEvent) {
    if (e.button === 0) startMoving()
  }

  function handleResizeStart(corner: ResizeCorner, e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const start = beginResize()
    let frame = 0

    // 마우스 위치는 Rust가 OS에서 읽으므로 여기서는 움직였다는 신호로만 쓴다
    const onMove = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() =>
        void start.then((s) => resizeFromCorner(corner, s, MIN_WIDTH, MIN_HEIGHT)),
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
        <>
          <div
            className="window-handle window-handle-resize window-handle-resize-top-left"
            onPointerDown={(e) => handleResizeStart('topLeft', e)}
            title="드래그해서 크기 조절"
          />
          <div
            className="window-handle window-handle-resize window-handle-resize-bottom-right"
            onPointerDown={(e) => handleResizeStart('bottomRight', e)}
            title="드래그해서 크기 조절"
          />
        </>
      )}
    </>
  )
}
