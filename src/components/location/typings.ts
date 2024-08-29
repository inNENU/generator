import type { BaseComponentOptions } from "../common.js";

export interface LocationConfig {
  /** 位置信息 */
  loc: `${number},${number}`;
  /** 地点名称 */
  name?: string;
  /** 地点详情 */
  detail?: string;
  /** 地图模块中的路径 */
  path?: string;
}

export interface LocationComponentOptions extends BaseComponentOptions {
  tag: "location";
  /** 地点标题 */
  title: string;
  /** 媒体文件的在线网址或本地路径	 */
  points: LocationConfig[];
  /**
   * 是否可以导航
   *
   * @default true
   */
  navigate?: boolean;
}
