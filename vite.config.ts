/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // göreli yollar: herhangi bir statik hostta / alt klasörde çalışır
  plugins: [react(), tailwindcss()],
  test: { include: ['src/**/*.test.ts'] },
})
