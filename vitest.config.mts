import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], exclude: ["tests/e2e/**", "node_modules/**", ".next/**"] }, resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } } });

