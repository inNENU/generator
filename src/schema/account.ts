import * as zod from "zod";

import { httpsLinkSchema, imgSchema } from "./common.js";

export const wechatAccountInfoSchema = zod
  .strictObject({
    /** 微信公众号名称 */
    name: zod.string().meta({
      description: "微信公众号名称",
    }),
    /** 微信公众号描述 */
    desc: zod.string().meta({
      description: "微信公众号描述",
    }),
    /** 微信公众号 logo */
    logo: imgSchema.meta({
      description: "微信公众号 logo",
    }),
    /** 微信公众号 ID */
    id: zod.string().meta({
      description: "微信公众号 ID",
    }),
    /** 微信公众号路径 */
    path: zod
      .string()
      .meta({
        description: "微信公众号路径",
      })
      .optional(),
    /** 是否允许跳转 */
    allowed: zod
      .boolean()
      .meta({
        description: "是否允许跳转",
      })
      .optional(),
  })
  .meta({
    id: "wechat-account-info",
    description: "微信公众号信息",
  });

export const qqAccountInfoSchema = zod
  .strictObject({
    /** QQ 账号名称 */
    name: zod.string().meta({
      description: "QQ 账号名称",
    }),
    /** QQ 账号描述 */
    desc: zod.string().meta({
      description: "QQ 账号描述",
    }),
    /** QQ 账号 logo */
    logo: imgSchema.meta({
      description: "QQ 账号 logo",
    }),
    /** QQ 号 */
    id: zod.number().min(10000).max(5000000000).meta({
      description: "QQ 号",
    }),
    /** QQ 账号二维码 */
    qrcode: imgSchema
      .meta({
        description: "QQ 账号二维码",
      })
      .optional(),
  })
  .meta({
    id: "qq-account-info",
    description: "QQ 账号信息",
  });

export type WechatAccountInfo = zod.infer<typeof wechatAccountInfoSchema>;

export type QQAccountInfo = zod.infer<typeof qqAccountInfoSchema>;

export const qqAccountGroupSchema = zod
  .strictObject({
    name: zod.string().meta({
      description: "QQ 账号组名称",
    }),
    account: zod.array(qqAccountInfoSchema).meta({
      description: "QQ 账号列表",
    }),
  })
  .meta({
    id: "qq-account-group",
    description: "QQ 账号组",
  });

export const qqAccountsSchema = zod.array(qqAccountGroupSchema).meta({
  id: "qq-accounts",
  description: "QQ 账号数据",
});

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

export const wechatAccountGroupSchema = zod
  .strictObject({
    name: zod.string().meta({
      description: "微信公众号组名称",
    }),
    account: zod.array(wechatAccountInfoSchema).meta({
      description: "微信公众号列表",
    }),
  })
  .meta({
    id: "wechat-account-group",
    description: "微信公众号组",
  });

export const wechatAccountsSchema = zod.array(wechatAccountGroupSchema).meta({
  id: "wechat-accounts",
  description: "微信公众号数据",
});

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

export const wechatArticleSchema = zod
  .strictObject({
    cover: httpsLinkSchema.meta({
      description: "文章封面",
    }),
    title: zod.string().meta({
      description: "文章标题",
    }),
    url: httpsLinkSchema.meta({
      description: "文章链接",
    }),
    desc: zod
      .string()
      .meta({
        description: "文章描述",
      })
      .optional(),
  })
  .meta({
    id: "wechat-article",
    description: "微信文章",
  });

export type WechatArticle = zod.infer<typeof wechatArticleSchema>;

export const wechatAccountDataSchema = zod
  .strictObject({
    /** 账户名称 */
    name: zod.string().meta({
      description: "账户名称",
    }),
    /** 账户全名 */
    detail: zod
      .string()
      .meta({
        description: "账户全名",
      })
      .optional(),
    /** 账户描述 */
    desc: zod
      .string()
      .meta({
        description: "账户描述",
      })
      .optional(),
    /** 微信公众号 ID */
    id: zod.string().meta({
      description: "微信公众号 ID",
    }),
    /** 账户图标 */
    logo: imgSchema.meta({
      description: "账户图标",
    }),
    /** 关注链接 */
    follow: httpsLinkSchema
      .meta({
        description: "关注链接",
      })
      .optional(),
    /** 文章 */
    article: zod.array(wechatArticleSchema).meta({
      description: "文章列表",
    }),
  })
  .meta({
    id: "wechat-account-data",
    description: "微信公众号数据",
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
