import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // amazon-cognito-identity-js가 의존하는 buffer 패키지가 Node 전역 `global`을
  // 참조한다. 브라우저에는 없으므로 globalThis로 매핑해 흰 화면(로드 에러)을 방지.
  define: {
    global: 'globalThis',
  },
  server: {
    host: true,          // 컨테이너 외부(호스트 브라우저)에서 접근 허용
    port: 5173,
    strictPort: true,
    proxy: {
      // 로컬 백엔드(FastAPI, 8000)로 API 프록시
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
