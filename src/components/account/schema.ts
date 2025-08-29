import * as zod from "zod";

import {
  envListSchema,
  internalImgSchema,
  locSchema,
} from "../../schema/common.js";

export const qqSchema = zod
  .number()
  .min(10001, "QQ号至少5位")
  .max(9999999999, "QQ号不能超过10位")
  .max(5000000000);

export const qqidSchema = zod.string().length(32, "非法的 QQ 号 ID");

export const wxidSchema = zod
  .string()
  .regex(/^[a-zA-Z][-_a-zA-Z0-9]{5,19}$/, "非法的微信公众号 ID");

export const accountSchema = zod.strictObject({
  tag: zod.literal("account"),
  /** 主体名称 */
  name: zod.string(),
  /** 图标地址 */
  logo: internalImgSchema,
  /** 账户详情 */
  detail: zod.string().optional(),
  /** 主体描述 */
  desc: zod.string().optional(),
  /** 账户 QQ 号 */
  qq: qqSchema.optional(),
  /** 账户 QQ 二维码 */
  qqcode: internalImgSchema.optional(),
  /** 微信公众号 ID */
  wxid: wxidSchema.optional(),
  /** 账户 ID */
  account: zod.string().optional(),
  /** 位置  */
  loc: locSchema.optional(),
  /** 邮箱地址 */
  mail: zod.email().optional(),
  /** 网站地址 */
  site: zod.url({ protocol: /^https?$/ }).optional(),
  /** 环境列表 */
  env: envListSchema,
});

export type AccountComponentOptions = zod.infer<typeof accountSchema>;

export interface AccountComponentData
  extends Omit<AccountComponentOptions, "logo" | "qqcode"> {
  logo: string;
  qqcode?: string;
}

export const checkAccount = (
  account: AccountComponentOptions,
  location = "",
): void => {
  const result = accountSchema.safeParse(account);

  if (!result.success) {
    console.error(
      `${location} 发现非法 account 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
