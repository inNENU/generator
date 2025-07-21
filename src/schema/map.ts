import * as zod from "zod";

import { imgSchema, locSchema } from "./common.js";
import { pageConfigSchema, pageDataSchema } from "../page/schema.js";

export const mapPageConfigSchema = zod.strictObject({
  ...pageConfigSchema.shape,
  /** 地点图片 */
  photo: zod.array(imgSchema).optional(),
});

export const mapPageDataSchema = zod.strictObject({
  ...pageDataSchema.shape,
  /** 地点图片 */
  photo: zod.array(imgSchema).optional(),
});

/** 标记点 schema */
export const markerConfigSchema = zod.strictObject({
  /** 地点名称 */
  name: zod.string().min(1, "地点名称不能为空"),
  /** 位置信息 */
  loc: locSchema,
  /** 地点详细名称 */
  detail: zod.string().optional(),
  /** 地点介绍路径 */
  path: zod.string().optional(),
});

export const markerCategorySchema = zod.strictObject({
  /** 分类名称 */
  name: zod.string().min(1, "分类名称不能为空"),
  content: zod.array(markerConfigSchema).min(1, "分类内容不能为空"),
});

export const markersConfigSchema = zod.record(
  zod.string(),
  markerCategorySchema,
);

/** 标记点数据 schema */
export const markerDataSchema = zod.strictObject({
  ...markerConfigSchema.shape,
  id: zod.number().int().positive("标记点ID必须为正整数"),
});

export const markerCategoryItemSchema = zod.strictObject({
  path: zod.string().min(1, "分类路径不能为空"),
  name: zod.string().min(1, "分类名称不能为空"),
});

export const markersDataSchema = zod.strictObject({
  category: zod.array(markerCategoryItemSchema).min(1, "分类列表不能为空"),
  marker: zod.record(zod.string(), zod.array(markerDataSchema)),
});

// 导出类型
export type MapPageConfig = zod.infer<typeof mapPageConfigSchema>;
export type MapPageData = zod.infer<typeof mapPageDataSchema>;
export type MarkerConfig = zod.infer<typeof markerConfigSchema>;
export type MarkersConfig = zod.infer<typeof markersConfigSchema>;
export type MarkerData = zod.infer<typeof markerDataSchema>;
export type MarkerCategory = zod.infer<typeof markerCategoryItemSchema>;
export type MarkersData = zod.infer<typeof markersDataSchema>;

// 校验函数
export const checkMapPageConfig = (
  config: MapPageConfig,
  location = "",
): void => {
  const result = mapPageConfigSchema.safeParse(config);

  if (!result.success) {
    console.error(
      `${location} 发现非法地图页面配置:`,
      zod.prettifyError(result.error),
    );
  }
};

export const checkMapPageData = (data: MapPageData, location = ""): void => {
  const result = mapPageDataSchema.safeParse(data);

  if (!result.success) {
    console.error(
      `${location} 发现非法地图页面数据:`,
      zod.prettifyError(result.error),
    );
  }
};

export const checkMarkerConfig = (
  marker: MarkerConfig,
  location = "",
): void => {
  const result = markerConfigSchema.safeParse(marker);

  if (!result.success) {
    console.error(
      `${location} 发现非法标记点配置:`,
      zod.prettifyError(result.error),
    );
  }
};

export const checkMarkersConfig = (
  markers: MarkersConfig,
  location = "",
): void => {
  const result = markersConfigSchema.safeParse(markers);

  if (!result.success) {
    console.error(
      `${location} 发现非法标记点配置:`,
      zod.prettifyError(result.error),
    );
  }
};

export const checkMarkersData = (data: MarkersData, location = ""): void => {
  const result = markersDataSchema.safeParse(data);

  if (!result.success) {
    console.error(
      `${location} 发现非法标记点数据:`,
      zod.prettifyError(result.error),
    );
  }
};
