import { dts } from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";

export default [
  {
    input: "./src/index.ts",
    output: {
      file: "./dist/index.js",
      format: "esm",
      sourcemap: true,
    },
    plugins: [
      esbuild({
        charset: "utf8",
        minify: true,
        target: "node20",
      }),
    ],
    external: [/^node:/, "ali-oss", "js-yaml", "upath", "zod/v4"],
  },
  {
    input: "./src/index.ts",
    output: {
      file: "./dist/index.d.ts",
      format: "esm",
    },
    plugins: [dts()],
    external: [],
  },
  {
    input: "./src/typings.ts",
    output: {
      file: "./typings.d.ts",
      format: "esm",
    },
    external: [/^node:/, "zod/v4"],
    plugins: [dts({ respectExternal: true })],
  },
];
