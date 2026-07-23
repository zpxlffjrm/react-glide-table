import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "@tanstack/react-table",
    "@tanstack/react-virtual",
  ],
  esbuildOptions(options) {
    options.alias = {
      "@": "./src",
    };
  },
});
