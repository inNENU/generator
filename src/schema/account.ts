import * as zod from "zod/v4";

import { httpsLinkSchema, imgSchema } from "./common.js";

export const wechatAccountInfoSchema = zod.strictObject({
  name: zod.string(),
  desc: zod.string(),
  logo: imgSchema,
  path: zod.string(),
});

export const qqAccountInfoSchema = zod.strictObject({
  name: zod.string(),
  desc: zod.string(),
  logo: imgSchema,
  id: zod.number().min(10000).max(5000000000),
  qrcode: imgSchema.optional(),
  openid: zod.string().length(32).optional(),
});

export type WechatAccountInfo = zod.infer<typeof wechatAccountInfoSchema>;

export type QQAccountInfo = zod.infer<typeof qqAccountInfoSchema>;

export const qqAccountGroupSchema = zod.strictObject({
  name: zod.string(),
  account: zod.array(qqAccountInfoSchema),
});

export const qqAccountsSchema = zod.array(qqAccountGroupSchema);

export type QQAccounts = zod.infer<typeof qqAccountsSchema>;

export const checkQQAccounts = (data: QQAccounts, location: string): void => {
  try {
    zod.parse(qqAccountsSchema, data);
  } catch (error) {
    console.error(`${location} 发现非法 QQ 账号数据:`, error);
  }
};

export const wechatAccountGroupSchema = zod.strictObject({
  name: zod.string(),
  account: zod.array(wechatAccountInfoSchema),
});

export const wechatAccountsSchema = zod.array(wechatAccountGroupSchema);

export type WechatAccounts = zod.infer<typeof wechatAccountsSchema>;

export const checkWechatAccounts = (
  data: WechatAccounts,
  location: string,
): void => {
  try {
    zod.parse(wechatAccountsSchema, data);
  } catch (error) {
    console.error(`${location} 发现非法微信公众号数据:`, error);
  }
};

export const wechatArticleSchema = zod.object({
  cover: httpsLinkSchema,
  title: zod.string(),
  url: httpsLinkSchema,
  desc: zod.string().optional(),
});

export type WechatArticle = zod.infer<typeof wechatArticleSchema>;

export const wechatAccountDataSchema = zod.object({
  /** 账户名称 */
  name: zod.string(),
  /** 账户全名 */
  detail: zod.string().optional(),
  /** 账户描述 */
  desc: zod.string().optional(),
  /** 微信公众号 ID */
  id: zod.string(),
  /** 账户图标 */
  logo: imgSchema,
  /** 关注链接 */
  follow: httpsLinkSchema.optional(),
  /** 文章 */
  article: zod.array(wechatArticleSchema),
});

export type WechatAccountData = zod.infer<typeof wechatAccountDataSchema>;

export const checkWechatAccountData = (
  data: WechatAccountData,
  location: string,
): void => {
  try {
    zod.parse(wechatAccountDataSchema, data);
  } catch (error) {
    console.error(`${location} 发现非法微信公众号数据:`, error);
  }
};
