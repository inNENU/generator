import { checkKeys } from "@mr-hope/assert-type";

import type { AudioComponentOptions } from "./typings.js";
import { checkFile } from "../../utils.js";

export const getAudioJSON = (
  audio: AudioComponentOptions,
  location = "",
): AudioComponentOptions => {
  checkKeys(
    audio,
    {
      tag: "string",
      src: "string",
      name: ["string", "undefined"],
      author: ["string", "undefined"],
      poster: ["string", "undefined"],
      autoplay: ["boolean", "undefined"],
      loop: ["boolean", "undefined"],
      env: ["string[]", "undefined"],
    },
    location,
  );
  checkFile(audio.src, location);

  return audio;
};
