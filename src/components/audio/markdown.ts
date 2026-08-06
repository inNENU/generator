import { escapeHtml, getFileLink } from "../../utils.js";
import type { AudioComponentOptions } from "./schema.js";
import { checkAudio } from "./schema.js";

export const getAudioMarkdown = (audio: AudioComponentOptions, location = ""): string => {
  if (audio.env && !audio.env.includes("web")) return "";

  checkAudio(audio, location);

  const { src, name, author } = audio;

  return `\
<VidStack src="${escapeHtml(getFileLink(src) ?? "")}" title="${name ? `名称: ${escapeHtml(name)}` : ""} ${
    author ? `作者: ${escapeHtml(author)}` : ""
  }" />

`;
};
