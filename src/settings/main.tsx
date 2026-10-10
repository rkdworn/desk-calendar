import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './settings.css'
import { SettingsApp } from './SettingsApp.tsx'

// 트레이 메뉴 "설정"으로 여는 별도 창(src-tauri lib.rs의 open_settings)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>,
)
