import type { TitleComponentOptions } from "./schema.js";
import { checkTitle } from "./schema.js";
import { convertStyle } from "../../utils.js";

export const getTitleMarkdown = (component: TitleComponentOptions): string => {
  if (component.env && !component.env.includes("web")) return "";

  checkTitle(component);

  // 处理样式
  const style = convertStyle(component.style);
  const { text } = component;

  return style
    ? `\
## <span style="${style}">${text}</span>

`
    : `\
## ${component.text}

`;
};
