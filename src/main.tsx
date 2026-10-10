import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { inTauri, onAppearanceChanged } from './platform/tauri.ts'
import { applyAppearance, loadAppearance } from './settings/appearance.ts'

// 바탕화면에 붙은 Tauri 창에서는 배경을 반투명하게 한다(index.css의 html.desktop)
if (inTauri) document.documentElement.classList.add('desktop')

// 설정 창에서 고른 색·투명도. 설정 창에서 바꾸면 이벤트로 바로 다시 적용한다.
applyAppearance(loadAppearance())
if (inTauri) void onAppearanceChanged(applyAppearance)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
