import type { PhoneComponentData, PhoneComponentOptions } from "./schema.js";

export const getPhoneJSON = (phone: PhoneComponentOptions): PhoneComponentData => {
  // 复制一份，避免修改调用方传入的对象
  const data = { ...phone };

  for (const key in data) {
    if (typeof data[key as keyof PhoneComponentOptions] === "number")
      // @ts-expect-error: Type does not fit
      // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access
      data[key] = data[key].toString();
  }

  return data as PhoneComponentData;
};
