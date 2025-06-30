import type { TitleComponentOptions } from "./schema.js";
import { checkTitle } from "./schema.js";
import { resolveStyle } from "../../utils.js";

export const getTitleMarkdown = (component: TitleComponentOptions): string => {
  if (component.env && !component.env.includes("web")) return "";

  checkTitle(component);

  // 处理样式
  if (typeof component.style === "object")
    component.style = resolveStyle(component.style);
  const { text, style } = component;

  return style
    ? `\
## <span style="${style}">${text}</span>

`
    : `\
## ${component.text}

`;
};
