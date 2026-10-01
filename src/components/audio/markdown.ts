import { escapeHtml, getFileLink } from "../../utils.js";
import type { AudioComponentOptions } from "./schema.js";
import { checkAudio } from "./schema.js";

export const getAudioMarkdown = (audio: AudioComponentOptions, location = ""): string => {
  if (audio.env && !audio.env.includes("web")) return "";

  checkAudio(audio, location);

  const { src, name, author } = audio;

  // `@vuepress/plugin-media` 自 rc.110 起用 AudioPlayer（Video.js）取代了原先的 VidStack，
  // 组件没有 title 属性，名称/作者改为渲染在播放器上方的 Markdown 文本。
  const caption = [name, author].filter(Boolean).join(" ");

  return `\
${caption ? `${escapeHtml(caption)}\n\n` : ""}<AudioPlayer src="${escapeHtml(getFileLink(src) ?? "")}" />

`;
};
