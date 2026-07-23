import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"

const playgroundRoot = fileURLToPath(new URL(".", import.meta.url))
const srcRoot = fileURLToPath(new URL("../src", import.meta.url))

export default defineConfig({
  root: playgroundRoot,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: srcRoot,
      },
    ],
  },
  server: {
    port: 5173,
    open: true,
  },
})
