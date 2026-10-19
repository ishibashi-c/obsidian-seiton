import path from "node:path";
import { defineConfig } from "vite";

/**
 * ブラウザハーネス（spec 12.6章 層2）
 * 本物のUIコンポーネントをモックObsidian API上で表示し、
 * ブラウザ自動操作によるスクショ収集・操作検証を可能にする。
 */
export default defineConfig({
  resolve: {
    alias: {
      // src/** からの `from "obsidian"` をモックへ差し替える
      obsidian: path.resolve(import.meta.dirname, "mocks/obsidian.ts"),
    },
  },
  root: "harness",
  server: { port: 5178, strictPort: true },
});
