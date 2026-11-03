import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // um único .env na raiz do projeto (só variáveis VITE_* chegam ao browser)
  envDir: '..',
  server: {
    // permite importar ../shared/clubs.json
    fs: { allow: ['..'] },
    // em desenvolvimento, /api é servido pelo uvicorn (porta 8000)
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
