import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { EVENT_COLORS, findEventColor } from '../events/colors.ts'

interface EventColorPickerProps {
  // Google Calendar 일정 색 번호. undefined면 색 없는 일정(기본색)이다. 기본색은 고를 수 없다.
  value: string | undefined
  onChange: (colorId: string) => void
}

// 편집 창의 일정 색 선택. 지금 색을 보여 주는 버튼을 누르면 색 목록(구글 일정 색 11가지)이 펼쳐진다.
export function EventColorPicker({ value, onChange }: EventColorPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = findEventColor(value)

  // 목록 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  // 목록이 열려 있을 때 Esc는 편집 창이 아니라 목록만 닫는다
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
  }

  function choose(colorId: string) {
    onChange(colorId)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="event-color-picker" onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="event-color-current"
        aria-haspopup="true"
        aria-expanded={open}
        title="일정 색 바꾸기"
        onClick={() => setOpen(!open)}
      >
        <span className="event-color-swatch" style={{ background: current?.hex }} />
        {current?.name ?? '기본'}
      </button>
      {open && (
        <div className="event-color-list" role="group" aria-label="일정 색">
          {EVENT_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              className="event-color-option"
              style={{ background: color.hex }}
              title={color.name}
              aria-label={color.name}
              aria-pressed={color.id === current?.id}
              onClick={() => choose(color.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
