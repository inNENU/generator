import * as zod from "zod";

import {
  accountSchema,
  actionSchema,
  audioSchema,
  cardSchema,
  carouselSchema,
  checkAccount,
  checkAction,
  checkAudio,
  checkCard,
  checkCarousel,
  checkDoc,
  checkFooter,
  checkFunctionalList,
  checkGrid,
  checkImage,
  checkList,
  checkLocation,
  checkPhone,
  checkTable,
  checkText,
  checkTitle,
  checkVideo,
  docSchema,
  footerSchema,
  functionalListSchema,
  gridSchema,
  imageSchema,
  listSchema,
  locationSchema,
  phoneSchema,
  tableSchema,
  textComponentSchema,
  titleSchema,
  videoSchema,
} from "../components/schema.js";
import { useCompiled } from "../helpers/compile.js";
import { withDiscriminatorValues } from "../helpers/discriminated-union.js";
import { collectZodIssues } from "../helpers/validation.js";
import { iconSchema } from "../schema/common.js";

/** 卡片组件由多个形态组合而成，手动补充 `tag` 判别值 */
const cardComponentSchema = withDiscriminatorValues(cardSchema, ["card"]);

/** 文本组件由多个形态组合而成，手动补充 `tag` 判别值 */
const textSchema = withDiscriminatorValues(textComponentSchema, ["text", "p", "ol", "ul"]);

export const componentSchema = zod
  .discriminatedUnion("tag", [
    accountSchema,
    actionSchema,
    audioSchema,
    cardComponentSchema,
    carouselSchema,
    docSchema,
    footerSchema,
    functionalListSchema,
    gridSchema,
    imageSchema,
    listSchema,
    locationSchema,
    phoneSchema,
    tableSchema,
    textSchema,
    titleSchema,
    videoSchema,
  ])
  .meta({
    id: "component",
    description: "页面组件",
  });

export type ComponentOptions = zod.infer<typeof componentSchema>;

export const pageContentSchema = zod.array(componentSchema).min(1, "页面内容不能为空").meta({
  id: "page-content",
  description: "页面内容",
});

/**
 * 检查单个组件
 *
 * 除 zod 结构校验外，部分组件还包含路径存在性、表格列数等语义检查，必须按组件类型逐个执行。
 *
 * @param component 组件配置
 * @param location 组件所在位置
 * @param pageId 当前页面 ID
 * @returns 校验问题列表
 */
const checkComponent = (
  component: ComponentOptions,
  location: string,
  pageId: string,
): string[] => {
  switch (component.tag) {
    case "account": {
      return checkAccount(component, location);
    }

    case "action": {
      return checkAction(component, location);
    }

    case "audio": {
      return checkAudio(component, location);
    }

    case "card": {
      return checkCard(component, location, pageId);
    }

    case "carousel": {
      return checkCarousel(component, location);
    }

    case "doc": {
      return checkDoc(component, location);
    }

    case "footer": {
      return checkFooter(component, location);
    }

    case "functional-list": {
      return checkFunctionalList(component, location, pageId);
    }

    case "grid": {
      return checkGrid(component, location, pageId);
    }

    case "img": {
      return checkImage(component, location);
    }

    case "list": {
      return checkList(component, location, pageId);
    }

    case "location": {
      return checkLocation(component, location);
    }

    case "phone": {
      return checkPhone(component, location);
    }

    case "table": {
      return checkTable(component, location);
    }

    case "text":
    case "p":
    case "ol":
    case "ul": {
      return checkText(component, location, pageId);
    }

    case "title": {
      return checkTitle(component, location);
    }

    case "video": {
      return checkVideo(component, location);
    }

    default: {
      return [];
    }
  }
};

/**
 * 检查页面内容
 *
 * @param content 页面内容
 * @param location 内容所在位置
 * @param pageId 当前页面 ID
 * @returns 校验问题列表
 */
export const checkPageContent = (
  content: ComponentOptions[],
  location: string,
  pageId = "",
): string[] => {
  // 结构损坏时下面的 flatMap、in 运算等会抛出 TypeError，先确认内容整体是数组
  if (!Array.isArray(content)) {
    const message = `${location} 页面内容应为组件数组`;

    console.error(message);

    return [message];
  }

  const result = useCompiled(pageContentSchema).safeParse(content);

  // 页面内容整体不合法时不再逐组件做语义检查：损坏的组件（如 null、items 为非数组）
  // 会让校验函数在遍历时抛出 TypeError，掩盖真正的校验问题。
  if (!result.success) return collectZodIssues(location, "发现非法页面内容", result.error);

  const issues = content.flatMap((component, index) =>
    checkComponent(component, `${location} page.content[${index}]`, pageId),
  );

  // 多个组件可能产生相同的问题（如同一个缺失路径），去重后再返回
  return [...new Set(issues)];
};

export const pageTitleSchema = zod
  .string()
  .min(1, "页面标题不能为空")
  .max(30, "页面标题不能过长")
  .meta({
    id: "page-title",
    description: "页面标题",
  });

export const pageConfigSchema = zod
  .strictObject({
    /** 页面标题 */
    title: pageTitleSchema.meta({
      description: "页面标题",
    }),
    /** 页面图标 */
    icon: iconSchema.optional().meta({
      description: "页面图标",
    }),
    /** 是否被 AI 忽略 */
    aiIgnore: zod.boolean().optional().meta({
      description: "是否被 AI 忽略",
    }),
    /** AI 索引优先级（数字权重，缺省=0；越大越靠前，负数视为低优先级排索引末尾） */
    aiPriority: zod.number().optional().meta({
      description: "AI 索引优先级（缺省=0，越大越靠前；负数视为低优先级，排在索引末尾）",
    }),
    /** 页面描述 */
    desc: zod.string().optional().meta({
      description: "页面描述（页脚补充描述，小程序端展示）",
    }),
    /** 页面摘要（供 AI 索引） */
    summary: zod.string().optional().meta({
      description: "页面摘要",
    }),
    /**
     * 所属校区
     *
     * 供 AI 索引与校区过滤；仅当页面专属于某校区时声明，缺省=两校区通用。 取值为自由字符串，由使用方自行约定，生成器不做限制。
     */
    campus: zod.string().optional().meta({
      description: "所属校区（缺省=两校区通用；取值不限制，由使用方自行约定）",
    }),
    /** 页面关键词（供 AI 索引，不设上限） */
    keywords: zod.array(zod.string()).optional().meta({
      description: "页面关键词",
    }),
    /** 页面作者 */
    author: zod
      .union([zod.array(zod.string()), zod.string()])
      .optional()
      .meta({
        description: "页面作者",
      }),
    /** 页面最后更新时间 */
    time: zod.union([zod.iso.datetime(), zod.iso.date()]).optional().meta({
      description: "页面最后更新时间",
    }),
    /** 页面标识 */
    id: zod.string().optional().meta({
      description: "页面标识",
    }),
    /** 是否是灰色背景 */
    grey: zod.boolean().optional().meta({
      description: "是否是灰色背景",
    }),
    /** 页面内容 */
    content: pageContentSchema,
    /** 页面引用来源 */
    cite: zod
      .union([zod.array(zod.string()), zod.string()])
      .optional()
      .meta({
        description: "页面引用来源",
      }),
    /**
     * 页面内容是否已过时
     *
     * @default false
     */
    outdated: zod.boolean().optional().meta({
      description: "页面内容是否已过时",
    }),
    /**
     * 是否可以使用小程序的界面分享
     *
     * @default false
     */
    shareable: zod.boolean().optional().meta({
      description: "是否可以使用小程序的界面分享",
    }),
    /**
     * 是否可以下载二维码
     *
     * 当 shareable 为 true 时可以下载
     */
    qrcode: zod.union([zod.string(), zod.boolean()]).optional().meta({
      description: "是否可以下载二维码",
    }),
    /**
     * 是否在分享弹出菜单中显示联系客服
     *
     * @default true
     */
    contact: zod.boolean().optional().meta({
      description: "是否在分享弹出菜单中显示联系客服",
    }),
  })
  .meta({
    id: "page-config",
    description: "页面配置",
  });

export const pageDataSchema = zod
  .strictObject({
    /** 页面标题 */
    title: pageTitleSchema.meta({
      description: "页面标题",
    }),
    /** 页面图标 */
    icon: iconSchema.optional().meta({
      description: "页面图标",
    }),
    /** 页面描述 */
    desc: zod.string().optional().meta({
      description: "页面描述",
    }),
    /** 页面作者 */
    author: zod.string().optional().meta({
      description: "页面作者",
    }),
    /** 页面最后更新时间 */
    time: zod.string().optional().meta({
      description: "页面最后更新时间",
    }),
    /** 页面标识 */
    id: zod.string().min(1, "页面ID不能为空").meta({
      description: "页面标识",
    }),
    /** 是否是灰色背景 */
    grey: zod.boolean().optional().meta({
      description: "是否是灰色背景",
    }),
    /** 页面内容 */
    content: pageContentSchema,
    /** 页面图片 */
    images: zod.array(zod.string()).optional().meta({
      description: "页面图片",
    }),
    /** 页面引用来源 */
    cite: zod.array(zod.string()).optional().meta({
      description: "页面引用来源",
    }),
    /**
     * 页面内容是否已过时
     *
     * @default false
     */
    outdated: zod.boolean().optional().meta({
      description: "页面内容是否已过时",
    }),
    /**
     * 是否可以使用小程序的界面分享
     *
     * @default false
     */
    shareable: zod.boolean().optional().meta({
      description: "是否可以使用小程序的界面分享",
    }),
    /**
     * 是否可以下载二维码
     *
     * 当 shareable 为 true 时可以下载
     */
    qrcode: zod.union([zod.string(), zod.boolean()]).optional().meta({
      description: "是否可以下载二维码",
    }),
    /**
     * 是否在分享弹出菜单中显示联系客服
     *
     * @default true
     */
    contact: zod.boolean().optional().meta({
      description: "是否在分享弹出菜单中显示联系客服",
    }),
    /** 是否隐藏导航栏 */
    hidden: zod.boolean().optional().meta({
      description: "是否隐藏导航栏",
    }),
  })
  .meta({
    id: "page-data",
    description: "页面数据",
  });

export type PageConfig = zod.infer<typeof pageConfigSchema>;
export type PageData = zod.infer<typeof pageDataSchema>;

export interface CheckPageConfigOptions {
  /**
   * 是否强制图标
   *
   * @default false
   */
  iconRequired?: boolean;
}

/**
 * 检查页面配置
 *
 * @param config 页面配置
 * @param location 配置所在位置
 * @param options 检查选项
 * @returns 校验问题列表
 */
export const checkPageConfig = (
  config: PageConfig,
  location = "",
  options: CheckPageConfigOptions = {},
): string[] => {
  const result = useCompiled(pageConfigSchema).safeParse(config);
  const issues = result.success ? [] : collectZodIssues(location, "发现非法页面配置", result.error);

  if (options.iconRequired && !config.icon) {
    const message = `${location} 页面缺少图标`;

    console.error(message);

    issues.push(message);
  }

  return issues;
};

/**
 * 检查页面数据
 *
 * @param data 页面数据
 * @param location 数据所在位置
 * @returns 校验问题列表
 */
export const checkPageData = (data: PageData, location = ""): string[] => {
  const result = useCompiled(pageDataSchema).safeParse(data);

  return result.success ? [] : collectZodIssues(location, "发现非法页面数据", result.error);
};
