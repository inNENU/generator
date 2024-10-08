import type { PageConfig, PageData } from "../typings.js";

export interface ResourceVersionInfo {
  version: Record<string, number>;
  size: Record<string, number>;
}

export interface WechatAccountInfo {
  name: string;
  desc: string;
  logo: string;
  path: string;
}

export interface QQAccountInfo {
  name: string;
  desc: string;
  logo: string;
  id: number;
  qrcode?: string;
  openid?: string;
}

export type QQAccountsConfig = {
  name: string;
  account: QQAccountInfo[];
}[];

export type WechatAccountsConfig = {
  name: string;
  account: WechatAccountInfo[];
}[];

export interface WechatArticleConfig {
  cover: string;
  title: string;
  url: string;
  desc?: string;
}

export interface WechatAccountConfig {
  /** 账户名称 */
  name: string;
  /** 账户全名 */
  detail?: string;
  /** 账户描述 */
  desc?: string;
  /** 微信公众号 ID */
  id: string;
  /** 账户图标 */
  logo: string;
  /** 关注链接 */
  follow?: string;
  /** 文章 */
  article: WechatArticleConfig[];
}

export interface MapPageConfig extends PageConfig {
  photo?: string[];
}

export interface MapPageData extends PageData {
  photo?: string[];
}

export interface MusicInfo {
  /** 歌曲地址 */
  src: string;
  /** 歌曲封面 */
  cover: string;
  /** 标题 */
  title: string;
  /** 演唱者 */
  singer: string;
  /** 歌词 */
  lyric?: string;
}

export type MusicList = MusicInfo[];

/** 歌词配置 */
export interface LyricItem {
  time: number;
  text: string;
}

export type LyricData = LyricItem[];

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
