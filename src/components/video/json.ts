import type { VideoComponentOptions } from "./schema.js";
import { checkVideo } from "./schema.js";

export const getVideoJSON = (
  video: VideoComponentOptions,
  location = "",
): VideoComponentOptions => {
  checkVideo(video, location);

  return video;
};
