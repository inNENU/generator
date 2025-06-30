import type { PhoneComponentOptions } from "./schema.js";
import { checkPhone } from "./schema.js";

export const getPhoneJSON = (
  phone: PhoneComponentOptions,
  location = "",
): PhoneComponentOptions => {
  checkPhone(phone, location);

  for (const key in phone)
    if (typeof phone[key as keyof PhoneComponentOptions] === "number")
      // @ts-expect-error: Type does not fit
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      phone[key] = phone[key].toString();

  return phone;
};
