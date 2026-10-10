import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { fromFormValues, setAllDay, type EventFormValues } from '../events/eventForm.ts'
import type { NewCalendarEvent } from '../events/types.ts'
import './EventDialog.css'

interface EventDialogProps {
  initial: EventFormValues
  isNew: boolean
  onSave: (event: NewCalendarEvent) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export function EventDialog({ initial, isNew, onSave, onDelete, onClose }: EventDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const pressedOutside = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = fromFormValues(values)
    if (!result.ok) {
      setError(result.error)
      return
    }
    void run(() => onSave(result.event))
  }

  function handleDelete() {
    if (!onDelete) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    void run(onDelete)
  }

  // 모달 <dialog>의 바깥(::backdrop) 클릭은 dialog 자신에게 오므로 좌표로 상자 밖인지 가린다
  function isOutside(e: MouseEvent) {
    const box = dialogRef.current?.getBoundingClientRect()
    if (!box || e.target !== dialogRef.current) return false
    return e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom
  }

  // 누른 곳과 뗀 곳이 모두 바깥일 때만 닫는다. 입력 칸에서 드래그로 글자를 고르다
  // 바깥에서 놓는 경우는 닫지 않는다.
  function handleMouseDown(e: MouseEvent) {
    pressedOutside.current = isOutside(e)
  }

  function handleClick(e: MouseEvent) {
    if (pressedOutside.current && isOutside(e) && !busy) onClose()
    pressedOutside.current = false
  }

  const inputType = values.allDay ? 'date' : 'datetime-local'

  return (
    <dialog
      ref={dialogRef}
      className="event-dialog"
      onClose={onClose}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <form onSubmit={handleSubmit}>
        <h2>{isNew ? '새 일정' : '일정 수정'}</h2>

        <label>
          제목
          <input
            type="text"
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
            autoFocus
          />
        </label>

        <label className="event-dialog-inline">
          <input
            type="checkbox"
            checked={values.allDay}
            onChange={(e) => setValues(setAllDay(values, e.target.checked))}
          />
          종일
        </label>

        <div className="event-dialog-range">
          <label>
            시작
            <input
              type={inputType}
              value={values.start}
              onChange={(e) => setValues({ ...values, start: e.target.value })}
            />
          </label>
          <label>
            종료
            <input
              type={inputType}
              value={values.end}
              onChange={(e) => setValues({ ...values, end: e.target.value })}
            />
          </label>
        </div>

        {error && <p className="event-dialog-error">{error}</p>}

        <div className="event-dialog-actions">
          {onDelete && (
            <button type="button" className="danger" onClick={handleDelete} disabled={busy}>
              {confirmingDelete ? '정말 삭제' : '삭제'}
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button type="submit" className="primary" disabled={busy}>
            저장
          </button>
        </div>
      </form>
    </dialog>
  )
}
