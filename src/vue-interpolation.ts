/**
 * 站点 Markdown 中的 Vue 插值中和
 *
 * VuePress 会把生成的 Markdown 交给 Vue 编译，正文里的 `{{ ... }}` 会被当作 Vue 插值执行。 内容仓库的 Markdown
 * 是数据而不是模板，因此这里把插值起始符拆成 HTML 注释， 让渲染后的文本仍是 `{{ ... }}`，但 Vue 模板里不再出现可执行的插值。
 *
 * 顶层（0 列缩进）的围栏代码块会被 VuePress 加上 `v-pre`，其中的内容原样保留； 其余位置（行内代码、列表/引用块内围栏、缩进围栏、HTML 块等）一律中和：
 * 在代码/字面量上下文里会看到 `<!-- -->`，这是有意的保守取舍。
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

/** 顶层围栏代码块起始行 */
const topLevelFenceStart = /^(?<marker>`{3,}|~{3,})(?<rest>.*)$/u;

/**
 * 判断围栏信息是否会得到 VuePress 的 `v-pre`
 *
 * VuePress 会先 unescapeAll 信息串；含实体时无法可靠还原，按未受保护处理。
 *
 * @param info 围栏信息串
 * @returns 是否受 v-pre 保护
 */
const hasFenceVPre = (info: string): boolean => {
  const unescapedInfo = info.replaceAll("\\", "");

  if (/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/iu.test(unescapedInfo)) return false;

  return !/:no-v-pre\b/u.test(unescapedInfo);
};

/**
 * 判断一行是否为指定围栏的闭合行
 *
 * @param line 候选行
 * @param marker 围栏标记字符
 * @param length 围栏标记长度
 * @returns 是否闭合
 */
const isFenceClose = (line: string, marker: string, length: number): boolean => {
  const match = /^ {0,3}(?<marker>`{3,}|~{3,})[ \t]*$/u.exec(line);

  return Boolean(match && match[1][0] === marker && match[1].length >= length);
};

/** 会被 HTML/Markdown 解码成花括号的实体与百分号编码 */
const decodedBracePattern = /&(?:#(?:0*123|x0*7[bB]);|l(?:cub|brace);|r(?:cub|brace);)/gu;

/** 会被 URL 解码成花括号的百分号编码 */
const encodedBracePattern = /%(?:7[bB]|7[dD])/gu;

/**
 * 中和会被后续解码还原成花括号的文本
 *
 * 实体与百分号编码在 markdown-it / 浏览器解码后可能重新形成 `{{`， 必须在做字面拆分前先转义，避免绕过。
 *
 * @param value 原始 Markdown
 * @returns 不会解码出花括号的 Markdown
 */
const neutralizeDecodedBraces = (value: string): string =>
  value
    .replaceAll(decodedBracePattern, (match) => `&amp;${match.slice(1)}`)
    .replaceAll(encodedBracePattern, (match) => `%25${match.slice(1)}`)
    .replaceAll(/<\/?plaintext\b/giu, (tag) => `&lt;${tag.slice(1)}`);

/**
 * 中标 Markdown 输出中的 Vue 插值，避免站点构建时被当作模板执行
 *
 * @param value 生成的 Markdown
 * @returns 中和后的 Markdown
 */
export const escapeVueInterpolation = (value: string): string => {
  const lines = neutralizeDecodedBraces(value).split("\n");
  const protectedLines = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    const match = topLevelFenceStart.exec(lines[index]);

    if (!match) continue;

    const { marker, rest } = match.groups ?? {};

    if (!hasFenceVPre(rest.trim())) continue;

    for (let next = index + 1; next < lines.length; next += 1) {
      if (!isFenceClose(lines[next], marker[0], marker.length)) continue;

      for (let line = index; line <= next; line += 1) protectedLines.add(line);
      index = next;
      break;
    }
  }

  return lines
    .map((line, index) => (protectedLines.has(index) ? line : splitVueBraceRuns(line)))
    .join("\n");
};
