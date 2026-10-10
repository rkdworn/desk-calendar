import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri CLI 출력이 지워지지 않게 한다
  clearScreen: false,
  server: {
    // src-tauri/tauri.conf.json의 devUrl과 같아야 하므로 다른 포트로 넘어가지 않게 고정
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    // 캘린더(index.html)와 트레이 메뉴로 여는 설정 창(settings.html)은 별도 페이지다
    rolldownOptions: {
      input: { main: 'index.html', settings: 'settings.html' },
    },
  },
})
