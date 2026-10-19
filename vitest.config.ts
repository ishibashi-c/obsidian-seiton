import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // ユニットテストはObsidian APIに依存しない純関数を対象とするため、
      // requestUrlのみのスタブを差し込む（実APIは層2/3で検証）
      obsidian: path.resolve(
        import.meta.dirname,
        "tests/mocks/obsidian-stub.ts"
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
