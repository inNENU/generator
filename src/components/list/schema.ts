import * as zod from "zod";

import {
  channelProfileSchema,
  channelVideoSchema,
  envListSchema,
  iconSchema,
  officialArticleSchema,
  officialProfileSchema,
  pathSchema,
  urlSchema,
} from "../../schema/common.js";

const baseListItemSchema = zod.strictObject({
  /** 列表单元的显示文字 */
  text: zod.string().min(1, "列表文字不能为空"),
  /** 列表图标的本地路径或在线网址 */
  icon: iconSchema.optional(),
  /** 列表内容的描述 */
  desc: zod.string().optional(),
  /**
   * 隐藏该列表项
   *
   * @default false
   */
  hidden: zod.boolean().optional(),
  /** 环境列表 */
  env: envListSchema,
});

const listPathItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  ...pathSchema.shape,
});

const listPageItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  ...urlSchema.shape,
});

const officialProfileListItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  ...officialProfileSchema.shape,
});

const channelProfileListItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  ...channelProfileSchema.shape,
});

const articleListItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  ...officialArticleSchema.shape,
});

const videoListItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  ...channelVideoSchema.shape,
});

const listItemSchema = zod.union([
  baseListItemSchema,
  listPathItemSchema,
  listPageItemSchema,
  officialProfileListItemSchema,
  channelProfileListItemSchema,
  articleListItemSchema,
  videoListItemSchema,
]);

export const listSchema = zod.strictObject({
  tag: zod.literal("list"),
  /** 列表标题 */
  header: zod.string().optional(),
  /** 列表内容 */
  items: zod.array(listItemSchema).min(1, "至少需要一个列表项"),
  /** 列表页脚 */
  footer: zod.string().optional(),
  /** 环境列表 */
  env: envListSchema,
});

// 功能性列表项类型
const navigatorListItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  type: zod.literal("navigator"),
  /** 小程序提供的开放能力 */
  openType: zod
    .enum([
      "navigate",
      "redirect",
      "switchTab",
      "reLaunch",
      "navigateBack",
      "exit",
    ])
    .optional(),
  /** 跳转目标 */
  target: zod.enum(["self", "miniProgram"]).optional(),
  /** 跳转到的 url */
  url: zod.string().optional(),
});

const switchListItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  type: zod.literal("switch"),
  /** 所控变量在 storage 中的 key 值 */
  key: zod.string().min(1, "开关 key 不能为空"),
  /** 开关对应的函数名称 */
  handler: zod.string().optional(),
  /** 开关颜色 */
  color: zod.string().optional(),
});

const sliderListItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  type: zod.literal("slider"),
  /** 滑块所控变量在 storage 中的 key 值 */
  key: zod.string().min(1, "滑块 key 不能为空"),
  /** 滑块对应的函数名称 */
  handler: zod.string().optional(),
  /** 滑块的最小值 */
  min: zod.number().optional(),
  /** 滑块的最大值 */
  max: zod.number().optional(),
  /** 滑块的步长 */
  step: zod.number().positive("步长必须为正数").optional(),
});

const pickerListItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  type: zod.literal("picker"),
  /** 选择器中包含的值 */
  select: zod.array(zod.unknown()).min(1, "至少需要一个选择项"),
  /** 选择器当前值的索引 */
  current: zod.number().min(0, "当前值索引不能为负数").optional(),
  /** 选择器所控变量在 storage 中的 key 值 */
  key: zod.string().min(1, "选择器 key 不能为空"),
  /** 选择器对应的函数名称 */
  handler: zod.string().optional(),
  /** 是否为单列选择器 */
  single: zod.boolean().optional(),
});

const buttonListItemSchema = zod.strictObject({
  ...baseListItemSchema.shape,
  type: zod.literal("button"),
  /** 按钮颜色 */
  color: zod.string().optional(),
  /** 按钮对应的函数名称 */
  handler: zod.string().optional(),
  /** 开放类别 */
  openType: zod.enum(["contact", "share"]).optional(),
  /** 联系人/客服的 openid */
  openId: zod.string().optional(),
  /** 打开群资料卡片的群号 */
  groupId: zod.string().optional(),
});

const functionalListItemSchema = zod.union([
  listItemSchema,
  navigatorListItemSchema,
  switchListItemSchema,
  pickerListItemSchema,
  sliderListItemSchema,
  buttonListItemSchema,
]);

export const functionalListSchema = zod.strictObject({
  tag: zod.literal("functional-list"),
  /** 列表标题 */
  header: zod.union([zod.string(), zod.literal(false)]).optional(),
  /** 列表内容 */
  items: zod.array(functionalListItemSchema).min(1, "至少需要一个列表项"),
  /** 列表页脚 */
  footer: zod.string().optional(),
  /** 环境列表 */
  env: envListSchema,
});

export type BaseListComponentItemOptions = zod.infer<typeof baseListItemSchema>;
export type ListPathComponentItemOptions = zod.infer<typeof listPathItemSchema>;
export type ListPageComponentItemOptions = zod.infer<typeof listPageItemSchema>;
export type ListComponentItemOptions = zod.infer<typeof listItemSchema>;
export type ListComponentOptions = zod.infer<typeof listSchema>;

export type NavigatorListComponentItemOptions = zod.infer<
  typeof navigatorListItemSchema
>;
export type OfficialProfileListComponentItemOptions = zod.infer<
  typeof officialProfileListItemSchema
>;
export type ChannelProfileListComponentItemOptions = zod.infer<
  typeof channelProfileListItemSchema
>;
export type ArticleListComponentItemOptions = zod.infer<
  typeof articleListItemSchema
>;
export type VideoListComponentItemOptions = zod.infer<
  typeof videoListItemSchema
>;
export type SwitchListComponentItemOptions = zod.infer<
  typeof switchListItemSchema
>;
export type SliderListComponentItemOptions = zod.infer<
  typeof sliderListItemSchema
>;
export type PickerListComponentItemOptions = zod.infer<
  typeof pickerListItemSchema
>;
export type ButtonListComponentItemOptions = zod.infer<
  typeof buttonListItemSchema
>;

export type FunctionalListComponentItemOptions = zod.infer<
  typeof functionalListItemSchema
>;
export type FunctionalListComponentOptions = zod.infer<
  typeof functionalListSchema
>;

export const checkList = (list: ListComponentOptions, location = ""): void => {
  const result = listSchema.safeParse(list);

  if (!result.success) {
    console.error(
      `${location} 发现非法 list 数据:`,
      zod.prettifyError(result.error),
    );
  }
};

export const checkFunctionalList = (
  functionalList: FunctionalListComponentOptions,
  location = "",
): void => {
  const result = functionalListSchema.safeParse(functionalList);

  if (!result.success) {
    console.error(
      `${location} 发现非法 functional list 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
