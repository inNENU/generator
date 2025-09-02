import * as zod from "zod";

import { imgSchema, locSchema } from "./common.js";
import { pageConfigSchema, pageDataSchema } from "../page/schema.js";

export const mapPageConfigSchema = zod
  .strictObject({
    ...pageConfigSchema.shape,
    /** 地点图片 */
    photo: zod
      .array(imgSchema)
      .meta({
        description: "地点图片",
      })
      .optional(),
  })
  .meta({
    id: "map-page-config",
    description: "地图页面配置",
  });

export const mapPageDataSchema = zod
  .strictObject({
    ...pageDataSchema.shape,
    /** 地点图片 */
    photo: zod
      .array(imgSchema)
      .meta({
        description: "地点图片",
      })
      .optional(),
  })
  .meta({
    id: "map-page-data",
    description: "地图页面数据",
  });

/** 标记点 schema */
export const markerConfigSchema = zod
  .strictObject({
    /** 地点名称 */
    name: zod.string().min(1, "地点名称不能为空").meta({
      description: "地点名称",
    }),
    /** 位置信息 */
    loc: locSchema.meta({
      description: "位置信息",
    }),
    /** 地点详细名称 */
    detail: zod
      .string()
      .meta({
        description: "地点详细名称",
      })
      .optional(),
    /** 地点介绍路径 */
    path: zod
      .string()
      .meta({
        description: "地点介绍路径",
      })
      .optional(),
  })
  .meta({
    id: "marker-config",
    description: "标记点配置",
  });

export const markerCategorySchema = zod
  .strictObject({
    /** 分类名称 */
    name: zod.string().min(1, "分类名称不能为空").meta({
      description: "分类名称",
    }),
    content: zod.array(markerConfigSchema).min(1, "分类内容不能为空").meta({
      description: "分类内容",
    }),
  })
  .meta({
    id: "marker-category",
    description: "标记点分类",
  });

export const markersConfigSchema = zod
  .record(zod.string(), markerCategorySchema)
  .meta({
    id: "markers-config",
    description: "标记点配置集合",
  });

/** 标记点数据 schema */
export const markerDataSchema = zod
  .strictObject({
    ...markerConfigSchema.shape,
    id: zod.number().int().positive("标记点ID必须为正整数").meta({
      description: "标记点ID",
    }),
  })
  .meta({
    id: "marker-data",
    description: "标记点数据",
  });

export const markerCategoryItemSchema = zod
  .strictObject({
    path: zod.string().min(1, "分类路径不能为空").meta({
      description: "分类路径",
    }),
    name: zod.string().min(1, "分类名称不能为空").meta({
      description: "分类名称",
    }),
  })
  .meta({
    id: "marker-category-item",
    description: "标记点分类项",
  });

export const markersDataSchema = zod
  .strictObject({
    category: zod
      .array(markerCategoryItemSchema)
      .min(1, "分类列表不能为空")
      .meta({
        description: "分类列表",
      }),
    marker: zod.record(zod.string(), zod.array(markerDataSchema)).meta({
      description: "标记点数据",
    }),
  })
  .meta({
    id: "markers-data",
    description: "标记点数据集合",
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
