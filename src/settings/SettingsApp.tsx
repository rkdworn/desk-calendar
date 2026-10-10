import { useEffect, useState } from 'react'
import { autostart, autostartAvailable, broadcastAppearance, inTauri } from '../platform/tauri.ts'
import {
  DEFAULT_APPEARANCE,
  loadAppearance,
  saveAppearance,
  type Appearance,
} from './appearance.ts'

const COLOR_FIELDS: { key: Exclude<keyof Appearance, 'opacity'>; label: string }[] = [
  { key: 'background', label: '배경색' },
  { key: 'text', label: '글씨색' },
  { key: 'today', label: '오늘 칸 색' },
  { key: 'event', label: '일정 블록 색' },
]

export function SettingsApp() {
  const [appearance, setAppearance] = useState(loadAppearance)

  function update(next: Appearance) {
    setAppearance(next)
    saveAppearance(next)
    if (inTauri) broadcastAppearance(next)
  }

  return (
    <main className="settings">
      <h1>설정</h1>

      <section>
        <h2>외관</h2>
        <label className="settings-row">
          <span>투명도</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round((1 - appearance.opacity) * 100)}
            onChange={(e) => update({ ...appearance, opacity: 1 - Number(e.target.value) / 100 })}
          />
          <output>{Math.round((1 - appearance.opacity) * 100)}%</output>
        </label>
        {COLOR_FIELDS.map(({ key, label }) => (
          <label key={key} className="settings-row">
            <span>{label}</span>
            <input
              type="color"
              value={appearance[key]}
              onChange={(e) => update({ ...appearance, [key]: e.target.value })}
            />
            <output>{appearance[key]}</output>
          </label>
        ))}
        <button type="button" className="settings-secondary" onClick={() => update(DEFAULT_APPEARANCE)}>
          기본값으로 되돌리기
        </button>
      </section>

      <section>
        <h2>일반</h2>
        <AutostartSwitch />
      </section>

      <section>
        <h2>계정</h2>
        <button type="button" className="settings-secondary" disabled>
          구글 계정 연결
        </button>
      </section>
    </main>
  )
}

function AutostartSwitch() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!inTauri || !autostartAvailable) return
    autostart.isEnabled().then(setEnabled, (e) => setError(String(e)))
  }, [])

  async function toggle(on: boolean) {
    setError(null)
    try {
      await autostart.set(on)
      setEnabled(await autostart.isEnabled())
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <>
      <label className="settings-row">
        <span>Windows 시작 시 자동 실행</span>
        <input
          type="checkbox"
          className="settings-switch"
          checked={enabled ?? false}
          disabled={!autostartAvailable || enabled === null}
          onChange={(e) => void toggle(e.target.checked)}
        />
      </label>
      {!autostartAvailable && <p className="settings-note">설치된 앱에서만 켤 수 있습니다(개발 모드).</p>}
      {error && <p className="settings-error">{error}</p>}
    </>
  )
}
