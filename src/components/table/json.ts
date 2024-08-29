import { assertType, checkKeys } from "@mr-hope/assert-type";

import type { TableComponentOptions } from "./typings.js";

export const getTableJSON = (
  table: TableComponentOptions,
  location = "",
): TableComponentOptions => {
  checkKeys(
    table,
    {
      tag: "string",
      caption: ["string", "undefined"],
      header: "string[]",
      body: "array",
      env: ["string[]", "undefined"],
    },
    location,
  );

  if (Array.isArray(table.body))
    table.body.forEach((item) => {
      assertType(item, "string[]");
    });

  return table;
};
