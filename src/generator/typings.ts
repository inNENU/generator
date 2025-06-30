export interface ResourceVersionInfo {
  version: Record<string, number>;
  size: Record<string, number>;
}

export interface LyricItem {
  /** 时间戳，单位为秒 */
  time: number;
  /** 歌词文本 */
  text: string;
}

export type LyricData = LyricItem[];
