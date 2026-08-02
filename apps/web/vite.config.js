import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

function loadDevVars() {
  const env = {}
  const file = path.resolve(__dirname, '.dev.vars')
  if (fs.existsSync(file)) {
    fs.readFileSync(file, 'utf-8').split('\n').forEach(line => {
      const [key, ...val] = line.split('=')
      if (key && val.length) env[key.trim()] = val.join('=').trim()
    })
  }
  return env
}

const devVars = loadDevVars()

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'LifeHub',
        short_name: 'LifeHub',
        description: '个人行动操作系统',
        theme_color: '#1f2933',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  define: {
    'import.meta.env.VITE_LIFEHUB_TOKEN': JSON.stringify(devVars.LIFEHUB_TOKEN || ''),
    'import.meta.env.VITE_TELEGRAM_BOT_TOKEN': JSON.stringify(devVars.TELEGRAM_BOT_TOKEN || '')
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})