import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "./src/index.ts",
    target: "node22",
    dts: true,
    platform: "node",
    fixedExtension: false,
    minify: true,
    sourcemap: true,
  },
  {
    entry: "./src/component-schema.ts",
    target: "node22",
    dts: true,
    platform: "node",
    fixedExtension: false,
    minify: true,
    sourcemap: true,
  },
  {
    entry: "./src/typings.ts",
    target: "node22",
    dts: true,
    platform: "node",
    fixedExtension: false,
    minify: true,
    sourcemap: true,
  },
]);
