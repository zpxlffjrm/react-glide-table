import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    core: "src/core/index.ts",
    compound: "src/compound/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: false,
  external: [
    "react",
    "react-dom",
    "@tanstack/react-table",
    "@tanstack/react-virtual",
  ],
  esbuildOptions(options) {
    options.alias = {
      "@": "./src",
    }
  },
})
