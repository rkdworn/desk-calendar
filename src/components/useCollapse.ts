import { useLayoutEffect, useState, type RefObject } from 'react'
import { inTauri, resizeHeight } from '../platform/tauri.ts'

const COLLAPSED_KEY = 'desk-calendar:collapsed'
const EXPANDED_HEIGHT_KEY = 'desk-calendar:expanded-height'
const DEFAULT_EXPANDED_HEIGHT = 760

// 접힌 상태에서는 날짜 칸을 숨기고(index.css의 html.collapsed) 창 높이를 상단 바만큼으로 줄인다.
// 접힘 여부와 펼칠 때 돌아갈 높이는 다음 실행을 위해 저장한다. 창 위치·크기 자체는 Rust가 저장한다.
export function useCollapse(surfaceRef: RefObject<HTMLElement | null>) {
  const [collapsed, setCollapsed] = useState(
    () => inTauri && localStorage.getItem(COLLAPSED_KEY) === 'true',
  )

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('collapsed', collapsed)
    if (!collapsed) return
    // FullCalendar가 높이를 auto로 다시 그린 뒤에 잰다
    const frame = requestAnimationFrame(() => {
      const surface = surfaceRef.current
      const root = surface?.parentElement
      if (!surface || !root) return
      const style = getComputedStyle(root)
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      void resizeHeight(surface.offsetHeight + padding)
    })
    return () => cancelAnimationFrame(frame)
  }, [collapsed, surfaceRef])

  function toggle() {
    if (collapsed) {
      const saved = Number(localStorage.getItem(EXPANDED_HEIGHT_KEY))
      void resizeHeight(saved || DEFAULT_EXPANDED_HEIGHT)
    } else {
      localStorage.setItem(EXPANDED_HEIGHT_KEY, String(window.innerHeight))
    }
    localStorage.setItem(COLLAPSED_KEY, String(!collapsed))
    setCollapsed(!collapsed)
  }

  return { collapsed, toggle }
}
