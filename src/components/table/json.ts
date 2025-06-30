import type { TableComponentOptions } from "./schema.js";
import { checkTable } from "./schema.js";

export const getTableJSON = (
  table: TableComponentOptions,
  location = "",
): TableComponentOptions => {
  checkTable(table, location);

  return table;
};
