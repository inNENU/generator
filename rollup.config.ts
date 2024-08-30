import dts from "rollup-plugin-dts";
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
        minify: true,
        target: "node18",
      }),
    ],
    external: [/^node:/, "@mr-hope/assert-type", "js-yaml", "upath"],
  },
  {
    input: "./src/index.ts",
    output: {
      file: "./dist/index.d.ts",
      format: "esm",
    },
    plugins: [dts()],
    external: ["domhandler"],
  },
  {
    input: "./src/typings.ts",
    output: {
      file: "./typings.d.ts",
      format: "esm",
    },
    plugins: [dts()],
  },
];
