import { useEffect, useState } from 'react'
import { google, inTauri, onGoogleAuthChanged } from '../platform/tauri.ts'

// 구글 계정이 연결되어 있는지. 확인 전에는 null이다. 일반 브라우저에서는 항상 false.
// 설정 창에서 연결·해제하거나 구글 쪽에서 연결이 끊기면 이벤트로 바로 바뀐다.
export function useGoogleConnected(): boolean | null {
  const [connected, setConnected] = useState<boolean | null>(inTauri ? null : false)

  useEffect(() => {
    if (!inTauri) return
    let disposed = false
    const unlisten = onGoogleAuthChanged(setConnected)
    google.status().then(
      (status) => {
        if (!disposed) setConnected(status.connected)
      },
      (e: unknown) => {
        console.error('failed to read google status', e)
        if (!disposed) setConnected(false)
      },
    )
    return () => {
      disposed = true
      void unlisten.then((stop) => stop())
    }
  }, [])

  return connected
}
