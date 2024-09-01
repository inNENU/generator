import type { BaseComponentOptions } from "../common.js";

export interface BaseTextComponentOptions extends BaseComponentOptions {
  /** 文字标签 */
  tag: "text" | "p" | "ol" | "ul";
  /** 段落标题 */
  header?: string | false;
  /** 段落文字 */
  text?: string[];
  /** 段落文字样式 */
  style?: string;
  /**
   * 段落对齐方式
   *
   * @default "left"
   */

  align?: "left" | "right" | "center" | "justify";
}

export interface PlainTextComponentOptions extends BaseTextComponentOptions {
  /**
   * 段落类型
   *
   * @default 'none'
   */
  type?: "none";
}

export interface PageTextComponentOptions extends BaseTextComponentOptions {
  /**
   * 段落类型
   *
   * @default 'none'
   */
  type: "tip" | "warning" | "danger" | "info" | "note";

  /**
   * 跳转到的路径
   *
   * @description 只有当指定样式时才有效
   */
  path?: string;
}

export interface NormalTextComponentOptions extends BaseTextComponentOptions {
  /** 跳转的链接 */
  url: string;
}

export interface MiniprogramTextComponentOptions
  extends BaseTextComponentOptions {
  /** 要打开的小程序 appId */
  appId: string;

  /** 打开的页面路径 */
  path?: string;

  /** 需要传递给目标小程序的数据， */
  extraData?: Record<string, unknown>;

  /** 要打开的小程序版本。仅在当前小程序为开发版或体验版时此参数有效。如果当前小程序是正式版，则打开的小程序必定是正式版。
   *
   * 可选值:
   * - 'develop': 开发版;
   * - 'trial': 体验版;
   * - 'release': 正式版; */
  versionType?: "develop" | "trial" | "release";
}

export type TextComponentOptions =
  | PlainTextComponentOptions
  | NormalTextComponentOptions
  | PageTextComponentOptions
  | MiniprogramTextComponentOptions;
