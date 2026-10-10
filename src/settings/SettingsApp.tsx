import { useEffect, useState } from 'react'
import {
  autostart,
  autostartAvailable,
  broadcastAppearance,
  describeGoogleError,
  google,
  inTauri,
  isSignInCancelled,
  onGoogleAuthChanged,
  type GoogleStatus,
} from '../platform/tauri.ts'
import {
  DEFAULT_APPEARANCE,
  loadAppearance,
  saveAppearance,
  type Appearance,
} from './appearance.ts'

const COLOR_FIELDS: { key: Exclude<keyof Appearance, 'opacity' | 'eventOpacity'>; label: string }[] = [
  { key: 'background', label: '배경색' },
  { key: 'text', label: '글씨색' },
  { key: 'today', label: '오늘 칸 색' },
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
        <TransparencySlider
          label="투명도"
          opacity={appearance.opacity}
          onChange={(opacity) => update({ ...appearance, opacity })}
        />
        <TransparencySlider
          label="일정 투명도"
          opacity={appearance.eventOpacity}
          onChange={(eventOpacity) => update({ ...appearance, eventOpacity })}
        />
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
        <GoogleAccount />
      </section>
    </main>
  )
}

// 불투명도(0~1)를 투명도(0~100%)로 보여 주고 고른다
function TransparencySlider({
  label,
  opacity,
  onChange,
}: {
  label: string
  opacity: number
  onChange: (opacity: number) => void
}) {
  const transparency = Math.round((1 - opacity) * 100)
  return (
    <label className="settings-row">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={transparency}
        onChange={(e) => onChange(1 - Number(e.target.value) / 100)}
      />
      <output>{transparency}%</output>
    </label>
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

function GoogleAccount() {
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!inTauri) return
    google.status().then(setStatus, (e: unknown) => setError(describeGoogleError(e)))
    // 구글 쪽에서 연결이 끊긴 것을 캘린더 창이 알게 된 경우에도 온다
    const unlisten = onGoogleAuthChanged((connected) => setStatus((s) => s && { ...s, connected }))
    return () => void unlisten.then((stop) => stop())
  }, [])

  async function signIn() {
    setError(null)
    setSigningIn(true)
    try {
      await google.signIn()
    } catch (e) {
      if (!isSignInCancelled(e)) setError(describeGoogleError(e))
    } finally {
      setSigningIn(false)
    }
  }

  async function signOut() {
    setError(null)
    try {
      await google.signOut()
    } catch (e) {
      setError(describeGoogleError(e))
    }
  }

  const connected = status?.connected ?? false
  return (
    <>
      <div className="settings-row settings-account">
        <span>{connected ? '구글 캘린더와 연결됨' : '연결 안 됨 (이 PC에만 저장)'}</span>
        {signingIn ? (
          <button type="button" className="settings-secondary" onClick={() => void google.cancelSignIn()}>
            취소
          </button>
        ) : connected ? (
          <button type="button" className="settings-secondary" onClick={() => void signOut()}>
            연결 해제
          </button>
        ) : (
          <button
            type="button"
            className="settings-secondary"
            disabled={!status?.configured}
            onClick={() => void signIn()}
          >
            구글 계정 연결
          </button>
        )}
      </div>
      {signingIn && <p className="settings-note">브라우저에서 구글 로그인을 마쳐 주세요.</p>}
      {status && !status.configured && (
        <p className="settings-note">
          구글 OAuth 클라이언트 없이 빌드된 앱입니다(src-tauri/google-oauth.json).
        </p>
      )}
      {error && <p className="settings-error">{error}</p>}
    </>
  )
}
