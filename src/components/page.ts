import type { AccountComponentOptions } from "./account/schema.js";
import type { ActionComponentOptions } from "./action/schema.js";
import type { AudioComponentOptions } from "./audio/schema.js";
import type { CardComponentOptions } from "./card/schema.js";
import type { CarouselComponentOptions } from "./carousel/schema.js";
import type { DocComponentOptions } from "./doc/schema.js";
import type { FooterComponentOptions } from "./footer/schema.js";
import type { GridComponentOptions } from "./grid/schema.js";
import type { ImageComponentOptions } from "./img/schema.js";
import type {
  FunctionalListComponentOptions,
  ListComponentOptions,
} from "./list/schema.js";
import type { LocationComponentOptions } from "./location/schema.js";
import type { PhoneComponentOptions } from "./phone/schema.js";
import type { TableComponentOptions } from "./table/schema.js";
import type { TextComponentOptions } from "./text/schema.js";
import type { TitleComponentOptions } from "./title/schema.js";
import type { VideoComponentOptions } from "./video/schema.js";

export type PageTag =
  | "account"
  | "action"
  | "audio"
  | "card"
  | "carousel"
  | "doc"
  | "footer"
  | "functional-list"
  | "grid"
  | "img"
  | "list"
  | "table"
  | "title"
  | "text"
  | "phone"
  | "video";

export type ComponentOptions =
  | AccountComponentOptions
  | ActionComponentOptions
  | AudioComponentOptions
  | CarouselComponentOptions
  | CardComponentOptions
  | DocComponentOptions
  | FooterComponentOptions
  | FunctionalListComponentOptions
  | GridComponentOptions
  | ListComponentOptions
  | LocationComponentOptions
  | ImageComponentOptions
  | PhoneComponentOptions
  | TableComponentOptions
  | TextComponentOptions
  | TitleComponentOptions
  | VideoComponentOptions;

/** 页面配置 */
export interface PageConfig {
  /** 页面标题 */
  title: string;
  /** 页面图标 */
  icon: string;
  /** 是否被 AI 忽略 */
  aiIgnore?: boolean;
  /** 页面标签 */
  tags?: string[];
  /** 页面描述 */
  desc?: string;
  /** 页面作者 */
  author?: string[] | string;
  /** 页面最后更新时间 */
  time?: Date;
  /** 页面标识 */
  id: string;
  /** 是否是灰色背景 */
  grey?: boolean;
  /** 页面内容 */
  content: ComponentOptions[];
  /**
   * 页面引用来源
   */
  cite?: string[] | string;
  /**
   * 页面内容是否已过时
   *
   * @default false
   */
  outdated?: boolean;
  /**
   * 是否可以使用小程序的界面分享
   *
   * @default false
   */
  shareable?: boolean;
  /**
   * 是否可以下载二维码
   *
   * @description Can download when shareable is true
   */
  qrcode?: string | boolean;
  /**
   * 是否在分享弹出菜单中显示联系客服
   *
   * @default true
   */
  contact?: boolean;
  /** 是否隐藏导航栏 */
  hidden?: boolean;
}

/** 页面数据 */
export interface PageData {
  /** 页面标题 */
  title: string;
  /** 页面图标 */
  icon: string;
  /** 页面描述 */
  desc?: string;
  /** 页面作者 */
  author?: string;
  /** 页面最后更新时间 */
  time?: string;
  /** 页面标识 */
  id: string;
  /** 是否是灰色背景 */
  grey?: boolean;
  /** 页面内容 */
  content: ComponentOptions[];
  /** 页面图片 */
  images?: string[];
  /**
   * 页面引用来源
   */
  cite?: string[];
  /**
   * 页面内容是否已过时
   *
   * @default false
   */
  outdated?: boolean;
  /**
   * 是否可以使用小程序的界面分享
   *
   * @default false
   */
  shareable?: boolean;
  /**
   * 是否可以下载二维码
   *
   * @description Can download when shareable is true
   */
  qrcode?: string | boolean;
  /**
   * 是否在分享弹出菜单中显示联系客服
   *
   * @default true
   */
  contact?: boolean;
  /** 是否隐藏导航栏 */
  hidden?: boolean;
}
