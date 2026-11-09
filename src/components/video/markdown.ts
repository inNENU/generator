import { sanitizeUrl } from "../../helpers/url.js";
import { escapeHtml, getFileLink } from "../../utils.js";
import type { VideoComponentOptions } from "./schema.js";
import { checkVideo } from "./schema.js";

export const getVideoMarkdown = (video: VideoComponentOptions, location = ""): string => {
  if (video.env && !video.env.includes("web")) return "";

  checkVideo(video, location);

  const { src, poster, title } = video;
  const safeSrc = sanitizeUrl(getFileLink(src));
  const safePoster = sanitizeUrl(getFileLink(poster));

  // `@vuepress/plugin-media` 自 rc.110 起用 VideoPlayer（Video.js）取代了原先的 VidStack，
  // 组件没有 title 属性，标题改为渲染在播放器上方的 Markdown 文本。
  const caption = title ? `${escapeHtml(title)}\n\n` : "";

  if (!safeSrc) return caption;

  return `\
${caption}<VideoPlayer src="${escapeHtml(safeSrc)}"${
    safePoster ? ` poster="${escapeHtml(safePoster)}"` : ""
  } />

`;
};
