import { randomUUID } from "node:crypto";

/**
 * 中和 Vue 模板插值
 *
 * VuePress 会把 Markdown 原文中的 `{{ ... }}` 交给 Vue 当作模板表达式执行。VuePress 默认开启 Markdown 的 HTML 支持，
 * markdown-it 还会解码 `&#123;` 之类的字符引用、消费 `\{` 的转义反斜杠，所以只处理字面 `{{` 会留下绕过路径。
 *
 * 这里保留围栏代码块、成对行内代码与 HTML 标签的原文，由 VuePress 的 v-pre 和 Vue 的静态属性语义保证安全；原始 HTML 块内部的文本不能按代码处理，
 * 其中的花括号会照常拆开。正文中的连续花括号用 HTML 注释拆开，渲染后仍是原始字符，Vue 编译时不会再识别为插值。
 */
const vueInterpolationOpenAtomSource = String.raw`(?:\\?\{|&#(?:0*123|[xX]0*7[bB]);|&(?:lbrace|lcub);)`;
const vueInterpolationCloseAtomSource = String.raw`(?:\\?\}|&#(?:0*125|[xX]0*7[dD]);|&(?:rbrace|rcub);)`;
const vueInterpolationOpenAtom = new RegExp(vueInterpolationOpenAtomSource, "gu");
const vueInterpolationCloseAtom = new RegExp(vueInterpolationCloseAtomSource, "gu");
const vueInterpolationOpenRun = new RegExp(
  String.raw`${vueInterpolationOpenAtomSource}(?:\\*${vueInterpolationOpenAtomSource})+`,
  "gu",
);
const vueInterpolationCloseRun = new RegExp(
  String.raw`${vueInterpolationCloseAtomSource}(?:\\*${vueInterpolationCloseAtomSource})+`,
  "gu",
);
const markdownFenceStart = /^ {0,3}(?<fence>`{3,}|~{3,})/u;
const markdownFenceClose = /^ {0,3}(?:`{3,}|~{3,})[ \t]*$/u;
const isValidHtmlComment = (comment: string): boolean => {
  const body = comment.slice(4, -3);

  // CommonMark 不允许注释体包含 `--`；markdown-it 会把这种“注释”当普通文本，
  // 其中的字符引用随后会被解码，不能按注释放过。
  return (
    !body.includes("--") &&
    !body.includes("<!--") &&
    !body.startsWith(">") &&
    !body.startsWith("->") &&
    !body.endsWith("-")
  );
};
const markdownHtmlTag =
  /<\/?[A-Za-z][\w-]*(?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/gu;
const htmlBlockTagSource =
  "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
const htmlTagOnlyLine =
  /^ {0,3}<\/?[A-Za-z][\w-]*(?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>\s*$/u;
const htmlBlockStart = new RegExp(
  String.raw`^ {0,3}<(?<closing>/)?(?<tag>${htmlBlockTagSource})\b`,
  "iu",
);
const htmlVerbatimStart = /^ {0,3}<(?<tag>pre|script|style|textarea)\b/iu;
const htmlCommentStart = /^ {0,3}<!--/u;
const htmlProcessingStart = /^ {0,3}<\?/u;
const htmlCdataStart = /^ {0,3}<!\[CDATA\[/u;
const htmlDeclarationStart = /^ {0,3}<![A-Z]/u;

/**
 * 读取行首围栏标记
 *
 * 反引号围栏的信息串包含反引号时 markdown-it 不会把它识别为围栏，因此这里同步拒绝； 波浪号围栏没有这个限制。
 *
 * @param line 单行文本
 * @returns 围栏字符、长度与信息串，非围栏行时为 null
 */
const getFenceInfo = (line: string): { marker: string; length: number; info: string } | null => {
  const match = markdownFenceStart.exec(line);

  if (!match) return null;

  const [, fence] = match;
  const info = line.slice(match[0].length).trim();

  if (fence[0] === "`" && info.includes("`")) return null;

  return { marker: fence[0], length: fence.length, info };
};

/**
 * 去掉行首的引用块标记
 *
 * @param line 单行文本
 * @returns 去掉引用标记后的文本
 */
const stripBlockquotePrefix = (line: string): string => line.replace(/^(?: {0,3}> ?)+/u, "");

/**
 * 判断一行是否是缩进代码（包括列表项内的缩进代码）
 *
 * VuePress 只给围栏和行内代码加 v-pre，缩进代码会原样进入 Vue 模板。
 *
 * @param line 单行文本
 * @returns 是否是缩进代码
 */
const isIndentedCodeLine = (line: string): boolean => {
  const stripped = stripBlockquotePrefix(line);

  return (
    /^(?: {4}|\t)/u.test(stripped) ||
    /^(?: {0,3})(?:[-+*]|\d{1,9}[.)])(?:[ \t]{4,}|[ \t]*\t)/u.test(stripped)
  );
};

/**
 * 读取列表项内围栏代码块的信息
 *
 * @param line 单行文本
 * @returns 围栏信息，非列表项围栏时为 null
 */
const getListItemFenceInfo = (
  line: string,
): { marker: string; length: number; info: string } | null => {
  const match =
    /^(?: {0,3})(?:[-+*]|\d{1,9}[.)])[ \t]+(?<fenceLine> {0,3}(?:`{3,}|~{3,}).*)$/u.exec(
      stripBlockquotePrefix(line),
    );

  return match?.groups?.fenceLine ? getFenceInfo(match.groups.fenceLine) : null;
};

/**
 * 标记列表项内的围栏代码块
 *
 * 这些围栏不在行首，不能按顶层围栏遮蔽；其中的花括号一律拆开，避免 :no-v-pre 时进入 Vue 模板。
 *
 * @param lines 全部行
 * @param htmlBlockLines 原始 HTML 块行号
 * @returns 列表项围栏的行号集合
 */
const collectListItemFenceLines = (lines: string[], htmlBlockLines: Set<number>): Set<number> => {
  const result = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (htmlBlockLines.has(index)) continue;

    const fence = getListItemFenceInfo(lines[index]);

    if (!fence) continue;

    result.add(index);

    for (let next = index + 1; next < lines.length; next += 1) {
      const candidateLine = stripBlockquotePrefix(lines[next]).trimStart();
      const candidate = getFenceInfo(candidateLine);

      if (
        candidate &&
        candidate.marker === fence.marker &&
        candidate.length >= fence.length &&
        markdownFenceClose.test(candidateLine)
      ) {
        for (let cursor = index; cursor <= next; cursor += 1) result.add(cursor);

        index = next;
        break;
      }
    }
  }

  return result;
};

/**
 * 标记引用块或顶层围栏代码块所在的行
 *
 * `desc` 会被逐行加上 `> `，围栏代码块因此不在行首；这些行不能按普通行做标签遮蔽。
 *
 * @param lines 全部行
 * @param htmlBlockLines 原始 HTML 块行号
 * @returns 围栏代码块行号
 */
const collectBlockquoteFenceLines = (lines: string[], htmlBlockLines: Set<number>): Set<number> => {
  const result = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (htmlBlockLines.has(index)) continue;

    const fence = getFenceInfo(stripBlockquotePrefix(lines[index]));

    if (!fence) continue;

    result.add(index);

    for (let next = index + 1; next < lines.length; next += 1) {
      const candidateLine = stripBlockquotePrefix(lines[next]).trimStart();
      const candidate = getFenceInfo(candidateLine);

      if (
        candidate &&
        candidate.marker === fence.marker &&
        candidate.length >= fence.length &&
        markdownFenceClose.test(candidateLine)
      ) {
        for (let cursor = index; cursor <= next; cursor += 1) result.add(cursor);

        index = next;
        break;
      }
    }
  }

  return result;
};

/**
 * 判断围栏代码块是否会被 VuePress 标记为 v-pre
 *
 * `:no-v-pre` 会关闭 VuePress 的 v-pre，此时不能把代码原文交给 Vue 解析。
 *
 * @param info 围栏信息串
 * @returns 是否受 v-pre 保护
 */
const hasFenceVPre = (info: string): boolean => {
  // VuePress 在判断 v-pre 前会 unescapeAll 信息串：反斜杠与实体都可能还原出 ":no-v-pre"。
  // 无法可靠还原时按未受保护处理，最多多拆几个花括号。
  const unescapedInfo = info.replaceAll("\\", "");

  if (/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/iu.test(unescapedInfo)) return false;

  return !/:no-v-pre\b/u.test(unescapedInfo);
};

/**
 * 找到包含指定结束标记的行
 *
 * @param lines 全部行
 * @param start 起始行
 * @param marker 结束标记
 * @returns 结束行，找不到时为最后一行
 */
const findLineWith = (lines: string[], start: number, marker: string): number => {
  for (let index = start; index < lines.length; index += 1)
    if (stripBlockquotePrefix(lines[index]).includes(marker)) return index;

  return lines.length - 1;
};

/**
 * 找到原始 HTML 块的结束行
 *
 * Markdown 不会解析原始 HTML 块内部的代码围栏 / 反引号，因此这些区域不能按代码放过。
 *
 * @param lines 全部行
 * @param start 起始行
 * @returns 结束行，非 HTML 块时为 null
 */
const getHtmlBlockEnd = (lines: string[], start: number): number | null => {
  const line = stripBlockquotePrefix(lines[start]);

  if (htmlCommentStart.test(line)) return findLineWith(lines, start, "-->");
  if (htmlProcessingStart.test(line)) return findLineWith(lines, start, "?>");
  if (htmlCdataStart.test(line)) return findLineWith(lines, start, "]]>");
  if (htmlDeclarationStart.test(line)) return findLineWith(lines, start, ">");

  const verbatim = htmlVerbatimStart.exec(line);

  if (verbatim) {
    const [, tag] = verbatim;
    const closing = new RegExp(String.raw`</${tag}>`, "iu");

    for (let index = start; index < lines.length; index += 1)
      if (closing.test(stripBlockquotePrefix(lines[index]))) return index;

    return lines.length - 1;
  }

  if (!htmlBlockStart.test(line) && !htmlTagOnlyLine.test(line)) return null;

  for (let index = start + 1; index < lines.length; index += 1)
    if (stripBlockquotePrefix(lines[index]).trim() === "") return index - 1;

  return lines.length - 1;
};

/**
 * 找到围栏代码块的闭合行
 *
 * @param lines 全部行
 * @param start 起始行
 * @param fence 起始围栏信息
 * @returns 闭合行，找不到时为 -1
 */
const findFenceClose = (
  lines: string[],
  start: number,
  fence: { marker: string; length: number },
): number => {
  for (let index = start + 1; index < lines.length; index += 1) {
    const closeFence = getFenceInfo(lines[index]);

    if (
      closeFence &&
      closeFence.marker === fence.marker &&
      closeFence.length >= fence.length &&
      markdownFenceClose.test(lines[index])
    )
      return index;
  }

  return -1;
};

/**
 * 判断某个字符是否被奇数个反斜杠转义
 *
 * @param content 文本
 * @param index 字符下标
 * @returns 是否处于转义状态
 */
const isEscaped = (content: string, index: number): boolean => {
  let backslashes = 0;

  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1)
    backslashes += 1;

  return backslashes % 2 === 1;
};

/**
 * 取从指定位置开始的反引号片段终点
 *
 * @param content 文本
 * @param start 起始位置
 * @returns 片段终点（不含）
 */
const getBacktickRunEnd = (content: string, start: number): number => {
  let end = start;

  while (content[end] === "`") end += 1;

  return end;
};

/**
 * 找到下一个可用作行内代码开头的反引号
 *
 * @param content 文本
 * @param from 起始位置
 * @returns 反引号位置，找不到时为 -1
 */
const findCodeSpanStart = (content: string, from: number): number => {
  let start = content.indexOf("`", from);

  while (start !== -1 && isEscaped(content, start))
    start = content.indexOf("`", getBacktickRunEnd(content, start));

  return start;
};

/**
 * 找到与开头反引号数量一致的闭合位置
 *
 * @param content 文本
 * @param from 起始位置
 * @param markerLength 开头反引号数量
 * @returns 闭合位置，找不到时为 -1
 */
const findCodeSpanClose = (content: string, from: number, markerLength: number): number => {
  let search = from;

  while (search < content.length) {
    const next = content.indexOf("`", search);

    if (next === -1) return -1;

    const nextEnd = getBacktickRunEnd(content, next);

    // markdown-it 允许被反斜杠转义的反引号闭合代码段（反斜杠在代码段内按字面量保留），
    // 因此这里不能像查找开头那样跳过转义反引号。
    if (nextEnd - next === markerLength) return next;

    search = nextEnd;
  }

  return -1;
};

/**
 * 按源码顺序遮蔽行内代码与 HTML 注释
 *
 * Markdown 先解析代码段、再解析行内 HTML。这里按同一顺序扫描：反引号在注释之前时先成对代码， 注释在反引号之前时先整体遮蔽注释，避免注释里的反引号破坏代码段边界。
 *
 * @param content 单行内容
 * @param stash 代码遮蔽函数
 * @param stashComment 注释遮蔽函数
 * @returns 遮蔽后的内容
 */
const maskInlineSyntax = (
  content: string,
  stash: (value: string) => string,
  stashComment: (comment: string) => string,
): string => {
  let result = "";
  let index = 0;

  while (index < content.length) {
    const codeStart = findCodeSpanStart(content, index);
    const commentStart = content.indexOf("<!--", index);

    if (
      commentStart !== -1 &&
      !isEscaped(content, commentStart) &&
      (codeStart === -1 || commentStart < codeStart)
    ) {
      const commentEnd = content.indexOf("-->", commentStart + 4);

      if (commentEnd === -1) {
        result += content.slice(index);
        break;
      }

      const comment = content.slice(commentStart, commentEnd + 3);

      result += content.slice(index, commentStart);
      result += isValidHtmlComment(comment) ? stashComment(comment) : comment;
      index = commentEnd + 3;
      continue;
    }

    if (codeStart === -1) {
      result += content.slice(index);
      break;
    }

    const openEnd = getBacktickRunEnd(content, codeStart);
    const markerLength = openEnd - codeStart;
    const closeStart = findCodeSpanClose(content, openEnd, markerLength);

    if (closeStart === -1) {
      result += content.slice(index, openEnd);
      index = openEnd;
      continue;
    }

    result += content.slice(index, codeStart);
    result += stash(content.slice(codeStart, closeStart + markerLength));
    index = closeStart + markerLength;
  }

  return result;
};

/**
 * 标记原始 HTML 块所在的行
 *
 * 原始 HTML 块中的反引号 / 围栏不会生成代码元素，不能按 Markdown 代码放过。
 *
 * @param lines 全部行
 * @returns 原始 HTML 块的行号集合
 */
const collectHtmlBlockLines = (lines: string[]): Set<number> => {
  const result = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    const fence = getFenceInfo(lines[index]);

    if (fence) {
      const closeIndex = findFenceClose(lines, index, fence);

      if (closeIndex !== -1) {
        index = closeIndex;
        continue;
      }
    }

    const htmlEnd = getHtmlBlockEnd(lines, index);

    if (htmlEnd == null) continue;

    for (let next = index; next <= htmlEnd; next += 1) result.add(next);

    index = htmlEnd;
  }

  return result;
};

/**
 * 遮蔽围栏代码块
 *
 * @param lines 全部行
 * @param htmlBlockLines 原始 HTML 块行号
 * @param listFenceLines 列表项围栏行号
 * @param stash 遮蔽函数
 * @returns 逐行结果
 */
const maskFenceBlocks = (
  lines: string[],
  htmlBlockLines: Set<number>,
  listFenceLines: Set<number>,
  stash: (value: string) => string,
): { lines: string[]; fenceLines: Set<number> } => {
  const result: string[] = [];
  const fenceLines = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (htmlBlockLines.has(index) || listFenceLines.has(index)) {
      result.push(line);
      continue;
    }

    const fence = getFenceInfo(line);

    if (!fence) {
      result.push(line);
      continue;
    }

    const closeIndex = findFenceClose(lines, index, fence);

    if (closeIndex === -1) {
      // 未闭合的围栏只是普通文本，不能当作代码放过其中的插值。
      result.push(line);
      continue;
    }

    const protectedByVPre = hasFenceVPre(fence.info);

    for (let next = index; next <= closeIndex; next += 1) {
      fenceLines.add(next);
      result.push(protectedByVPre ? stash(lines[next]) : lines[next]);
    }

    index = closeIndex;
  }

  return { lines: result, fenceLines };
};

/**
 * 暂时遮蔽代码与 HTML 标签，避免在代码 / 属性中插入注释
 *
 * @param content Markdown 内容
 * @returns 遮蔽后的内容与还原函数
 */
const maskMarkdownSyntax = (
  content: string,
): { masked: string; restore: (value: string) => string } => {
  const stashed: string[] = [];
  let nonce = randomUUID();

  while (content.includes(`\uE000${nonce}:`)) nonce = randomUUID();

  const placeholderPrefix = `\uE000${nonce}:`;
  const placeholderPattern = new RegExp(`\\uE000${nonce}:(?<index>\\d+)\uE001`, "gu");
  const stash = (value: string): string => `${placeholderPrefix}${stashed.push(value) - 1}\uE001`;
  // 注释里的花括号不会被 Vue 编译，但保留原文会让 "输出不含 {{" 的约定出现例外；
  // 这里改成字符引用，注释本身不可见。
  const stashComment = (comment: string): string =>
    stash(comment.replaceAll("{", "&#123;").replaceAll("}", "&#125;"));
  const lines = content.split("\n");
  const htmlBlockLines = collectHtmlBlockLines(lines);
  const listFenceLines = collectListItemFenceLines(lines, htmlBlockLines);
  const blockquoteFenceLines = collectBlockquoteFenceLines(lines, htmlBlockLines);
  const fenceResult = maskFenceBlocks(lines, htmlBlockLines, listFenceLines, stash);
  const tagMasked = fenceResult.lines
    .map((line, index) =>
      listFenceLines.has(index) ||
      blockquoteFenceLines.has(index) ||
      fenceResult.fenceLines.has(index) ||
      isIndentedCodeLine(line)
        ? line
        : line.replaceAll(markdownHtmlTag, (match: string, offset: number) =>
            isEscaped(line, offset) ? match : stash(match),
          ),
    )
    .join("\n");
  // 注释与行内代码按源码顺序处理，避免注释里的反引号与正文反引号错误配对。
  const masked = tagMasked
    .split("\n")
    .map((line, index) =>
      htmlBlockLines.has(index) ||
      listFenceLines.has(index) ||
      blockquoteFenceLines.has(index) ||
      fenceResult.fenceLines.has(index) ||
      isIndentedCodeLine(line)
        ? line
        : maskInlineSyntax(line, stash, stashComment),
    )
    .join("\n");

  const restore = (value: string): string => {
    let restored = value;
    let previous: string;

    do {
      previous = restored;
      placeholderPattern.lastIndex = 0;
      restored = restored.replaceAll(
        placeholderPattern,
        (_, index: string) => stashed[Number(index)],
      );
    } while (restored !== previous);

    return restored;
  };

  return { masked, restore };
};

/**
 * 在一段连续花括号中插入 HTML 注释
 *
 * @param run 连续花括号
 * @param atom 单个花括号（含实体 / 转义形式）
 * @returns 拆开后的内容
 */
const splitVueBraceRun = (run: string, atom: RegExp): string =>
  run.replaceAll(atom, "$&<!-- -->").replace(/<!-- -->$/u, "");

/**
 * 中和 Vue 插值
 *
 * @param content Markdown 内容
 * @returns 中和插值后的内容
 */
export const escapeVueInterpolation = (content: string): string => {
  const { masked, restore } = maskMarkdownSyntax(content);

  return restore(
    masked
      .replaceAll(vueInterpolationOpenRun, (run) => splitVueBraceRun(run, vueInterpolationOpenAtom))
      .replaceAll(vueInterpolationCloseRun, (run) =>
        splitVueBraceRun(run, vueInterpolationCloseAtom),
      ),
  );
};
