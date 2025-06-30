import * as zod from "zod/v4";

import { envListSchema } from "../../schema/common.js";

export const phoneNumberSchema = zod.union(
  [
    // 手机号
    zod.number().min(10000000000).max(19999999999),
    zod.string().regex(/^1\d{10}$/, "手机号格式不正确"),
    // 固定电话
    zod.string().regex(/^\d{3,4}-\d{7,8}$/),

    // 特殊电话号码
    zod.number().min(10000).max(12999),
    zod.number().min(95000).max(96999),
    zod.string().regex(/^\d{3,4}-(?:10|11|12|95|96)\d{3}$/),

    // 400 电话
    zod.string().regex(/^400-\d{3}-\d{4}$/),

    // 国际电话
    zod.string().regex(/^\d{2}-/),
  ],
  "电话号码格式不正确",
);

export const postCodeSchema = zod.union(
  [zod.string().regex(/^\d{6}$/), zod.number().min(100000).max(999999)],
  "邮政编码格式不正确",
);

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

export interface PhoneComponentData
  extends Omit<
    PhoneComponentOptions,
    "num" | "workNum" | "homeNum" | "hostNum" | "postCode"
  > {
  /** 联系人电话号码 */
  num: string;
  /** 联系人工作电话 */
  workNum?: string;
  /** 联系人住宅电话 */
  homeNum?: string;
  /** 联系人公司电话 */
  hostNum?: string;
  /** 联系人邮政编码 */
  postCode?: string;
}

export const checkPhone = (
  phone: PhoneComponentOptions,
  location = "",
): void => {
  try {
    phoneSchema.parse(phone);
  } catch (error) {
    console.error(`${location} 发现非法 phone 数据:`, error);
  }
};
