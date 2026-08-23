import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig, lazyPlugins } from "vite-plus"

export default defineConfig({
  fmt: {
    ignorePatterns: [".output/**", ".tanstack/**", "build/**", "dist/**", "src/routeTree.gen.ts"],
    printWidth: 120,
    semi: false,
    sortImports: true,
    trailingComma: "es5",
  },
  lint: {
    ignorePatterns: [".output/**", ".tanstack/**", "build/**", "dist/**", "src/routeTree.gen.ts"],
    jsPlugins: [
      { name: "anti-slop", specifier: "@zap-studio/oxlint/anti-slop" },
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
    ],
    rules: {
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: { typeAware: true, typeCheck: true },
  },
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() => [tailwindcss(), tanstackStart(), nitro(), viteReact()]),
  server: { host: "0.0.0.0", port: Number(process.env.PORT) || 3001 },
})
