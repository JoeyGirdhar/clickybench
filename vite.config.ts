import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so
// every asset URL needs the repo name in front of it. Getting this wrong is the
// classic "deploy succeeds, page renders blank white" bug. Change it if you
// fork this under a different repo name.
export default defineConfig({
  base: '/clickybench/',
  plugins: [react(), tailwindcss()],
  // Tailwind runs through the Vite plugin above, so there is no PostCSS step.
  // Pinning it empty stops Vite walking up the filesystem and picking up an
  // unrelated postcss config from a parent directory.
  css: { postcss: { plugins: [] } },
})
