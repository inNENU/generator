import type { AccountComponentOptions } from "./schema.js";
import { checkAccount } from "./schema.js";

export const getAccountJSON = (
  account: AccountComponentOptions,
  location = "",
): AccountComponentOptions => {
  checkAccount(account, location);

  return account;
};
