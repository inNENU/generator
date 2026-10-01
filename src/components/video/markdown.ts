import { escapeHtml, getFileLink } from "../../utils.js";
import type { VideoComponentOptions } from "./schema.js";
import { checkVideo } from "./schema.js";

export const getVideoMarkdown = (video: VideoComponentOptions, location = ""): string => {
  if (video.env && !video.env.includes("web")) return "";

  checkVideo(video, location);

  const { src, poster, title } = video;

  // `@vuepress/plugin-media` 自 rc.110 起用 VideoPlayer（Video.js）取代了原先的 VidStack，
  // 组件没有 title 属性，标题改为渲染在播放器上方的 Markdown 文本。
  const caption = title ? `${title}\n\n` : "";

  return `\
${caption}<VideoPlayer src="${escapeHtml(getFileLink(src) ?? "")}"${
    poster ? ` poster="${escapeHtml(poster)}"` : ""
  } />

`;
};
