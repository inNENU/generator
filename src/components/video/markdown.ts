import type { VideoComponentOptions } from "./schema.js";
import { checkVideo } from "./schema.js";
import { getFileLink } from "../../utils.js";

export const getVideoMarkdown = (video: VideoComponentOptions): string => {
  if (video.env && !video.env.includes("web")) return "";

  checkVideo(video);

  const { src, poster, title } = video;

  return `\
<VidStack src="${getFileLink(src)}"${title ? ` title="${title}"` : ""}${
    poster ? ` poster="${poster}"` : ""
  } />

`;
};
