import { defineHopeConfig } from "oxc-config-hope/oxlint";

export default defineHopeConfig(
  {
    rules: {
      "no-console": "off",
      "import/no-namespace": "off",
      "typescript/strict-boolean-expressions": "off",
    },
    node: true,
  },
  // max nested calls is disabled for schema files with zod
  {
    files: ["src/**/schema.ts"],
    rules: {
      "unicorn/max-nested-calls": "off",
    },
  },
);
