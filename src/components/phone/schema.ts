import * as zod from "zod/v4";

import { envListSchema } from "../common.js";

export const phoneNumberSchema = zod.union([
  zod
    .number()
    .min(10000000000, "手机号码为 11 位")
    .max(19999999999, "手机号码为 11 位"),
  zod.string().regex(/1\d{10}/, "手机号格式不正确"),
  zod.string().regex(/\d{4}-\d{7,8}/, "固定电话号码格式不正确"),
  zod.string().regex(/400-\d{3}-\d{4}/, "400 电话格式不正确"),
]);

export const postCodeSchema = zod.union([
  zod.string().regex(/^\d{6}$/, "邮政编码格式不正确"),
  zod
    .number()
    .min(100000, "邮政编码格式不正确")
    .max(999999, "邮政编码格式不正确"),
]);

export const phoneSchema = zod.strictObject({
  tag: zod.literal("phone"),
  /** 标题 */
  header: zod.string().optional(),
  /** 联系人电话号码 */
  num: phoneNumberSchema,
  /** 联系人的名 */
  fName: zod.string().min(1, "姓名不能为空"),
  /** 联系人的姓 */
  lName: zod.string().optional(),
  /** 联系人所在公司 */
  org: zod.string().optional(),
  /** 联系人的备注 */
  remark: zod.string().optional(),
  /** 联系人的工作电话 */
  workNum: phoneNumberSchema.optional(),
  /** 联系人的昵称 */
  nick: zod.string().optional(),
  /** 联系人头像图片路径(仅限本地路径) */
  avatar: zod.string().startsWith("/").optional(),
  /** 联系人的微信号 */
  wechat: zod.string().optional(),
  /** 联系人的地址省份 */
  province: zod.string().optional(),
  /** 联系人的地址城市 */
  city: zod.string().optional(),
  /** 联系人的地址街道 */
  street: zod.string().optional(),
  /** 联系人的地址邮政编码 */
  postCode: postCodeSchema.optional(),
  /** 联系人的职位 */
  title: zod.string().optional(),
  /** 联系人的公司电话 */
  hostNum: phoneNumberSchema.optional(),
  /** 联系人的网站 */
  site: zod.url({ protocol: /^https?$/ }).optional(),
  /** 联系人的电子邮件 */
  mail: zod.email().optional(),
  /** 联系人的住宅电话 */
  homeNum: phoneNumberSchema.optional(),
  /** 环境列表 */
  env: envListSchema,
});

export type PhoneComponentOptions = zod.infer<typeof phoneSchema>;

export const checkPhone = (
  phone: PhoneComponentOptions,
  location = "",
): void => {
  try {
    phoneSchema.parse(phone);
  } catch (error) {
    console.error(`Invalid phone data at ${location}:`, error);
  }
};
