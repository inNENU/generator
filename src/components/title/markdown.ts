import type { TitleComponentOptions } from "./typings.js";
import { resolveStyle } from "../../utils.js";

export const getTitleMarkdown = (component: TitleComponentOptions): string => {
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
