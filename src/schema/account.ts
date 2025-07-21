import * as zod from "zod";

import { httpsLinkSchema, imgSchema } from "./common.js";

export const wechatAccountInfoSchema = zod.strictObject({
  /** 微信公众号名称 */
  name: zod.string(),
  /** 微信公众号描述 */
  desc: zod.string(),
  /** 微信公众号 logo */
  logo: imgSchema,
  /** 微信公众号 ID */
  id: zod.string(),
  /** 微信公众号路径 */
  path: zod.string().optional(),
});

export const qqAccountInfoSchema = zod.strictObject({
  /** QQ 账号名称 */
  name: zod.string(),
  /** QQ 账号描述 */
  desc: zod.string(),
  /** QQ 账号 logo */
  logo: imgSchema,
  /** QQ 号 */
  id: zod.number().min(10000).max(5000000000),
  /** QQ 账号二维码 */
  qrcode: imgSchema.optional(),
  /** QQ 账号 OpenID */
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
  const result = qqAccountsSchema.safeParse(data);

  if (!result.success) {
    console.error(
      `${location} 发现非法 QQ 账号数据:`,
      zod.prettifyError(result.error),
    );
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
  const result = wechatAccountsSchema.safeParse(data);

  if (!result.success) {
    console.error(
      `${location} 发现非法微信公众号数据:`,
      zod.prettifyError(result.error),
    );
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
  const result = wechatAccountDataSchema.safeParse(data);

  if (!result.success) {
    console.error(
      `${location} 发现非法微信公众号数据:`,
      zod.prettifyError(result.error),
    );
  }
};
