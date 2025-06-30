import type { PageConfig, PageData } from "../typings.js";

export interface ResourceVersionInfo {
  version: Record<string, number>;
  size: Record<string, number>;
}

export interface MapPageConfig extends PageConfig {
  photo?: string[];
}

export interface MapPageData extends PageData {
  photo?: string[];
}

/** 标记点 */
export interface MarkerConfig {
  /** 地点名称 */
  name: string;
  /** 位置信息 */
  loc: `${number},${number}`;
  /** 地点详细名称 */
  detail: string;
  /** 地点介绍路径 */
  path?: string;
}

export type MarkersConfig = Record<
  string,
  {
    /** 分类名称 */
    name: string;
    content: MarkerConfig[];
  }
>;

/** 标记点数据 */
export interface MarkerData extends MarkerConfig {
  id: number;
}

export interface Category {
  path: string;
  name: string;
}

export interface MarkersData {
  category: Category[];

  marker: Record<string, MarkerData[]>;
}
