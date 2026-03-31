import { defineHopeConfig } from "oxc-config-hope/oxlint";

export default defineHopeConfig({
  rules: {
    "no-console": "off",
    "import/no-namespace": "off",
    "typescript/strict-boolean-expressions": "off",
  },
  node: true,
});
