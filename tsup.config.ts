import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: ["react", "react-dom", "@tanstack/react-table"],
  esbuildOptions(options) {
    options.alias = {
      "@": "./src",
    }
  },
})
