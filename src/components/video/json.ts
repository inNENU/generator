import { checkKeys } from "@mr-hope/assert-type";

import type { VideoComponentOptions } from "./typings.js";
import { checkFile } from "../../utils.js";

export const getVideoJSON = (
  video: VideoComponentOptions,
  location = "",
): VideoComponentOptions => {
  checkFile(video.src, location);

  checkKeys(
    video,
    {
      tag: "string",
      src: "string",
      loop: ["boolean", "undefined"],
      controls: ["boolean", "undefined"],
      title: ["string", "undefined"],
      poster: ["string", "undefined"],
      autoplay: ["boolean", "undefined"],
      startTime: ["number", "undefined"],
      danmuBtn: ["boolean", "undefined"],
      env: ["string[]", "undefined"],
    },
    location,
  );

  if (Array.isArray(video.danmuList)) {
    video.danmuList.forEach((item) => {
      checkKeys(item, {
        text: ["string", "undefined"],
        color: ["string", "undefined"],
        time: ["number", "undefined"],
      });
    });
  }

  return video;
};
