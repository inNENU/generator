import { checkKeys } from "@mr-hope/assert-type";

import type { AccountComponentOptions } from "./typings.js";
import { checkFile } from "../../utils.js";

export const getAccountJSON = (
  account: AccountComponentOptions,
  location = "",
): AccountComponentOptions => {
  checkKeys(
    account,
    {
      tag: "string",
      name: "string",
      logo: "string",
      detail: ["string", "undefined"],
      desc: ["string", "undefined"],
      qq: ["number", "undefined"],
      qqid: ["string", "undefined"],
      qqcode: ["string", "undefined"],
      wxid: ["string", "undefined"],
      wxcode: ["string", "undefined"],
      account: ["string", "undefined"],
      loc: ["string", "undefined"],
      mail: ["string", "undefined"],
      site: ["string", "undefined"],
      env: ["string[]", "undefined"],
    },
    location,
  );

  checkFile(account.logo);
  checkFile(account.qqcode);
  checkFile(account.wxcode);

  return account;
};
