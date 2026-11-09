import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/typings.ts", "src/component-schema.ts"],
      // 阈值比当前实测（约 89.6% statements / 78.5% branches / 90.0% functions /
      // 92.0% lines）低 1–2 个百分点：既能拦截覆盖率回归，又不会因轻微波动误报。
      // 覆盖率目标仍是向 100% 靠拢，但不强制；新增测试应尽量提高覆盖。
      // 不要开启 perFile：account.ts 等低覆盖文件会让整体门禁失败。
      thresholds: {
        branches: 77,
        functions: 88,
        lines: 90,
        statements: 88,
      },
    },
  },
});
