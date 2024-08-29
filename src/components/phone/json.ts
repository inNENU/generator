import { checkKeys } from "@mr-hope/assert-type";

import type { PhoneComponentOptions } from "./typings.js";

export const getPhoneJSON = (
  phone: PhoneComponentOptions,
  location = "",
): PhoneComponentOptions => {
  for (const key in phone)
    if (typeof phone[key as keyof PhoneComponentOptions] === "number")
      // @ts-expect-error: Type does not fit
      // eslint-disable-next-line
      phone[key] = phone[key].toString();

  checkKeys(
    phone,
    {
      tag: "string",
      num: "string",
      fName: "string",
      header: ["string", "undefined"],
      lName: ["string", "undefined"],
      org: ["string", "undefined"],
      remark: ["string", "undefined"],
      workNum: ["string", "undefined"],
      nick: ["string", "undefined"],
      site: ["string", "undefined"],
      wechat: ["string", "undefined"],
      province: ["string", "undefined"],
      city: ["string", "undefined"],
      street: ["string", "undefined"],
      postCode: ["string", "undefined"],
      title: ["string", "undefined"],
      hostNum: ["string", "undefined"],
      mail: ["string", "undefined"],
      homeNum: ["string", "undefined"],
      avatar: ["string", "undefined"],
      env: ["string[]", "undefined"],
    },
    location,
  );

  return phone;
};
