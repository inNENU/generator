import type { AudioComponentOptions } from "./schema.js";
import { checkAudio } from "./schema.js";
import { getFileLink } from "../../utils.js";

export const getAudioMarkdown = (
  audio: AudioComponentOptions,
  location = "",
): string => {
  if (audio.env && !audio.env.includes("web")) return "";

  checkAudio(audio, location);

  const { src, name, author } = audio;

  return `\
<VidStack src="${getFileLink(src)}" title="${name ? `名称: ${name}` : ""} ${
    author ? `作者: ${author}` : ""
  }" />

`;
};
