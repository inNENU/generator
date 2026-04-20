import type { PhoneComponentData, PhoneComponentOptions } from "./schema.js";

export const getPhoneJSON = (phone: PhoneComponentOptions): PhoneComponentData => {
  for (const key in phone) {
    if (typeof phone[key as keyof PhoneComponentOptions] === "number")
      // @ts-expect-error: Type does not fit
      // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access
      phone[key] = phone[key].toString();
  }

  return phone as PhoneComponentData;
};
