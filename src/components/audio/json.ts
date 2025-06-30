import type { AudioComponentOptions } from "./schema.js";
import { checkAudio } from "./schema.js";

export const getAudioJSON = (
  audio: AudioComponentOptions,
  location = "",
): AudioComponentOptions => {
  checkAudio(audio, location);

  return audio;
};
