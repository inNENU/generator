/**
 * 站点 Markdown 中的 Vue 插值中和
 *
 * VuePress 会把生成的 Markdown 交给 Vue 编译，正文里的 `{{ ... }}` 会被当作 Vue 插值执行。 内容仓库的 Markdown
 * 是数据而不是模板，因此这里把插值起始符拆成 HTML 注释， 让渲染后的文本仍是 `{{ ... }}`，但 Vue 模板里不再出现可执行的插值。
 *
 * 采用保守策略：所有位置的 `{{` / `}}` 都拆成 HTML 注释。 顶层围栏代码块理论上由 VuePress 的 `<pre v-pre>` 保护，但组件生成的原始 HTML 可能让
 * markdown-it 把围栏当作 HTML block 内容而不解析，无法可靠区分； 因此连代码块也一并中和——在代码/字面量上下文中会看到 `<!-- -->`，
 * 这是保证不执行插值的取舍。
 */

/** 连续的插值起始花括号 */
const vueInterpolationOpenRun = /\{\{+/gu;

/** 连续的插值结束花括号 */
const vueInterpolationCloseRun = /\}\}+/gu;

/**
 * 在连续花括号之间插入 HTML 注释，拆散 Vue 插值
 *
 * @param run 连续的花括号
 * @param comment 插入的注释
 * @returns 拆散后的文本
 */
const splitBraceRun = (run: string, comment: string): string =>
  run.replaceAll(/./gu, (char, index) => (index === run.length - 1 ? char : `${char}${comment}`));

/**
 * 拆散文本中的所有 Vue 插值花括号
 *
 * @param value 需要处理的文本
 * @returns 处理后的文本
 */
const splitVueBraceRuns = (value: string): string =>
  value
    .replaceAll(vueInterpolationOpenRun, (run) => splitBraceRun(run, "<!-- -->"))
    .replaceAll(vueInterpolationCloseRun, (run) => splitBraceRun(run, "<!-- -->"));

/** 会被 URL 解码成花括号的百分号编码 */
const encodedBracePattern = /%(?:7[bB]|7[dD])/gu;

/** 实体解码最多迭代的层数（防止病态输入造成长循环） */
const maxEntityDecodeDepth = 10;

/** 数字实体 body（不含 `&` 与 `;`）的匹配 */
const numericEntityPattern = /^#(?:(?<decimal>0*\d+)|[xX](?<hex>0*[\da-fA-F]+))$/u;

/** 单个 HTML 实体（含 `&` 与 `;`）的匹配 */
const htmlEntityPattern = /&(?:#(?:(?:0*\d+)|[xX]0*[\da-fA-F]+)|[a-zA-Z][a-zA-Z\d]*);/uy;

/** HTML 命名实体中可能表示 `&` 的形式 */
const ampersandEntityPattern = /^(?:amp|AMP)$/u;

/** 命名花括号实体 */
const braces: Record<string, string> = {
  lcub: "{",
  lbrace: "{",
  rcub: "}",
  rbrace: "}",
};

/**
 * 解码实体 body（不含开头 `&` 与结尾 `;`）
 *
 * @param body 实体 body
 * @returns 解码出的字符，不是已知实体则返回 `null`
 */
const decodeEntityBody = (body: string): string | null => {
  const numeric = numericEntityPattern.exec(body);

  if (numeric?.groups) {
    const { decimal, hex } = numeric.groups;
    const codePoint = decimal ? Math.trunc(Number(decimal)) : Number.parseInt(hex ?? "", 16);

    if (codePoint > 0x10ffff) return null;

    return String.fromCodePoint(codePoint);
  }

  if (ampersandEntityPattern.test(body)) return "&";

  return braces[body.toLowerCase()] ?? null;
};

/**
 * 解码从指定位置开始的一层 HTML 实体
 *
 * @param value 输入文本
 * @param index 实体起始位置（可能位于虚拟 `&` 之后）
 * @param hasAmpersandPrefix 是否已由上一层解码出 `&`
 * @returns 解码出的字符与实体结束位置，若不是实体则返回 `null`
 */
const decodeEntityAt = (
  value: string,
  index: number,
  hasAmpersandPrefix: boolean,
): { character: string; end: number } | null => {
  if (hasAmpersandPrefix) {
    const end = value.indexOf(";", index);

    if (end === -1 || end - index > 32) return null;

    const character = decodeEntityBody(value.slice(index, end));

    return character ? { character, end: end + 1 } : null;
  }

  htmlEntityPattern.lastIndex = index;

  const match = htmlEntityPattern.exec(value);

  if (!match || match.index !== index) return null;

  const character = decodeEntityBody(match[0].slice(1, -1));

  return character ? { character, end: index + match[0].length } : null;
};

/**
 * 沿实体链解码到最终字符
 *
 * 例如 `&#38;#123;` 会被解码成 `&` + `#123;`，再解码成 `{`。实体可能被 Markdown、插件与浏览器多次解码， 因此沿链最多解码
 * {@link maxEntityDecodeDepth} 层，得到最终字符与实体链结束位置。
 *
 * @param value 输入文本
 * @param index `&` 起始位置
 * @returns 最终字符与结束位置，若链条不产生花括号则返回 `null`
 */
const decodeEntityChain = (
  value: string,
  index: number,
): { character: string; end: number } | null => {
  let position = index;
  let hasAmpersandPrefix = false;

  for (let depth = 0; depth < maxEntityDecodeDepth; depth += 1) {
    const decoded = decodeEntityAt(value, position, hasAmpersandPrefix);

    if (!decoded) return null;

    position = decoded.end;

    if (decoded.character === "&") {
      hasAmpersandPrefix = true;
      continue;
    }

    return { character: decoded.character, end: position };
  }

  return null;
};

/**
 * 中和会被后续解码还原成花括号的实体
 *
 * 实体在 Markdown、插件（如 `@mdit/plugin-figure` 对图片 title 的二次解析）以及 Vue 编译过程中可能被多次解码，
 * 仅按固定前缀加实体层数不足。这里沿实体链解码，只要最终字符是花括号，就把整条链改写成「花括号 + HTML 注释」， 从而任意多次解码都只会得到被注释隔开的单个花括号。
 *
 * @param value 原始 Markdown
 * @returns 不会解码出 `{{` / `}}` 的 Markdown
 */
const neutralizeDecodedBraces = (value: string): string => {
  let result = "";
  let index = 0;

  while (index < value.length) {
    if (value[index] !== "&") {
      result += value[index];
      index += 1;
      continue;
    }

    const decoded = decodeEntityChain(value, index);

    if (decoded?.character === "{" || decoded?.character === "}") {
      result += decoded.character === "{" ? "{<!-- -->" : "}<!-- -->";
      index = decoded.end;
      continue;
    }

    result += "&";
    index += 1;
  }

  return result
    .replaceAll(encodedBracePattern, (match) => `%25${match.slice(1)}`)
    .replaceAll(/<\/?plaintext\b/giu, (tag) => `&lt;${tag.slice(1)}`);
};

/**
 * 还原 Markdown 反斜杠转义后的花括号文本
 *
 * Markdown 渲染时奇数个反斜杠会转义花括号并去掉转义用的反斜杠，偶数个反斜杠则两两还原为字面反斜杠。 这里按 Markdown 语义把转义序列还原为「2 × floor(n / 2)
 * 个反斜杠 + 花括号」的源文本（渲染后等价于 1 个反斜杠 + 花括号）， 再统一交给 字面花括号拆分，避免 `\{\{` 在渲染后重新拼成 `{{`。
 *
 * @param value 原始 Markdown
 * @returns 花括号不再依赖 Markdown 转义语义的文本
 */
const normalizeEscapedBraces = (value: string): string => {
  let result = "";
  let index = 0;

  while (index < value.length) {
    if (value[index] !== "\\") {
      result += value[index];
      index += 1;
      continue;
    }

    let end = index;

    while (value[end] === "\\") end += 1;

    const brace = value[end];

    if (brace !== "{" && brace !== "}") {
      result += value.slice(index, end);
      index = end;
      continue;
    }

    result += brace === "{" ? "{<!-- -->" : "}<!-- -->";
    index = end + 1;
  }

  return result;
};

/**
 * 中标 Markdown 输出中的 Vue 插值，避免站点构建时被当作模板执行
 *
 * @param value 生成的 Markdown
 * @returns 中和后的 Markdown
 */
export const escapeVueInterpolation = (value: string): string =>
  normalizeEscapedBraces(neutralizeDecodedBraces(value))
    .split("\n")
    .map((line) => splitVueBraceRuns(line))
    .join("\n");
