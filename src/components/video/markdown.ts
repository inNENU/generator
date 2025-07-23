import type { VideoComponentOptions } from "./schema.js";
import { checkVideo } from "./schema.js";
import { getFileLink } from "../../utils.js";

export const getVideoMarkdown = (
  video: VideoComponentOptions,
  location = "",
): string => {
  if (video.env && !video.env.includes("web")) return "";

  checkVideo(video, location);

  const { src, poster, title } = video;

  return `\
<VidStack src="${getFileLink(src)}"${title ? ` title="${title}"` : ""}${
    poster ? ` poster="${poster}"` : ""
  } />

`;
};
