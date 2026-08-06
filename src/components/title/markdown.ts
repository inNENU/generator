import { convertStyle, escapeHtml } from "../../utils.js";
import type { TitleComponentOptions } from "./schema.js";
import { checkTitle } from "./schema.js";

export const getTitleMarkdown = (component: TitleComponentOptions, location = ""): string => {
  if (component.env && !component.env.includes("web")) return "";

  checkTitle(component, location);

  // 处理样式
  const style = convertStyle(component.style);
  const { text } = component;

  return style
    ? `\
## <span style="${escapeHtml(style)}">${text}</span>

`
    : `\
## ${component.text}

`;
};
