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
const markdownFenceClose = /^ {0,3}(?:`{3,}|~{3,})[ \t]*\r?$/u;
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
  /<\/[A-Za-z][A-Za-z0-9-]*\s*>|<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/gu;
const htmlBlockTagSource =
  "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
const htmlTagOnlyLine =
  /^ {0,3}(?:<\/[A-Za-z][A-Za-z0-9-]*\s*>|<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>)\s*$/u;
const htmlBlockStart = new RegExp(
  String.raw`^ {0,3}<(?<closing>/)?(?<tag>${htmlBlockTagSource})\b`,
  "iu",
);
const htmlVerbatimStart = /^ {0,3}<(?<tag>pre|script|style|textarea)\b/iu;
const htmlCommentStart = /^ {0,3}<!--/u;
const htmlProcessingStart = /^ {0,3}<\?/u;
const htmlCdataStart = /^ {0,3}<!\[CDATA\[/u;
const htmlDeclarationStart = /^ {0,3}<![A-Z]/u;
const htmlRawTextStart = /<(?<tag>textarea|script|style|title|xmp|iframe|noembed|noframes)\b/iu;

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
    let closed = false;

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
        closed = true;
        break;
      }
    }

    if (!closed) {
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) result.add(cursor);
      break;
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
    let closed = false;

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
        closed = true;
        break;
      }
    }

    if (!closed) {
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) result.add(cursor);
      break;
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
 * 查找下一个未被转义的 HTML 标签
 *
 * @param content 单行内容
 * @param from 起始位置
 * @returns 标签起始位置与长度，找不到时为 null
 */
const findHtmlTag = (content: string, from: number): { index: number; length: number } | null => {
  markdownHtmlTag.lastIndex = from;

  let match = markdownHtmlTag.exec(content);

  while (match) {
    if (!isEscaped(content, match.index)) return { index: match.index, length: match[0].length };

    markdownHtmlTag.lastIndex = match.index + 1;
    match = markdownHtmlTag.exec(content);
  }

  return null;
};

const splitVueBraceRun = (run: string, atom: RegExp): string =>
  run.replaceAll(atom, "$&<!-- -->").replace(/<!-- -->$/u, "");

/**
 * 按源码顺序遮蔽行内代码、HTML 注释与 HTML 标签
 *
 * Markdown 先解析代码段、再解析行内 HTML。这里按同一顺序扫描：反引号在注释之前时先成对代码， 注释在反引号之前时先整体遮蔽注释，避免注释里的反引号破坏代码段边界。
 *
 * @param content 单行内容
 * @param stash 代码遮蔽函数
 * @param stashComment 注释遮蔽函数
 * @returns 遮蔽后的内容
 */
// oxlint-disable-next-line eslint/max-statements -- 顺序扫描的三种分支集中在此，拆分只会增加状态传递
const maskInlineSyntax = (
  content: string,
  stash: (value: string) => string,
  stashComment: (comment: string) => string,
): string => {
  // 形如 `](` 的残缺链接不会被 markdown-it 识别，若其中反引号与正文配对会把插值藏进代码段；
  // 这里先拆开其中的花括号，宁可让该行的行内代码失去 fidelity，也不留下模板执行面。
  const source = content.includes("](")
    ? content
        .replaceAll(vueInterpolationOpenRun, (run) =>
          splitVueBraceRun(run, vueInterpolationOpenAtom),
        )
        .replaceAll(vueInterpolationCloseRun, (run) =>
          splitVueBraceRun(run, vueInterpolationCloseAtom),
        )
    : content;
  let result = "";
  let index = 0;

  while (index < source.length) {
    const codeStart = findCodeSpanStart(source, index);
    const commentStart = source.indexOf("<!--", index);
    const tag = findHtmlTag(source, index);

    if (
      commentStart !== -1 &&
      !isEscaped(source, commentStart) &&
      (codeStart === -1 || commentStart < codeStart) &&
      (!tag || commentStart < tag.index)
    ) {
      const commentEnd = source.indexOf("-->", commentStart + 4);

      if (commentEnd === -1) {
        result += source.slice(index);
        break;
      }

      const comment = source.slice(commentStart, commentEnd + 3);

      result += source.slice(index, commentStart);
      result += isValidHtmlComment(comment) ? stashComment(comment) : comment;
      index = commentEnd + 3;
      continue;
    }

    // 标签与代码段按源码顺序处理：代码段先出现时整段保留，属性中的反引号不会破坏代码边界。
    if (tag && (codeStart === -1 || tag.index < codeStart)) {
      result += source.slice(index, tag.index);
      result += stash(source.slice(tag.index, tag.index + tag.length));
      index = tag.index + tag.length;
      continue;
    }

    if (codeStart === -1) {
      result += source.slice(index);
      break;
    }

    const openEnd = getBacktickRunEnd(source, codeStart);
    const markerLength = openEnd - codeStart;
    const closeStart = findCodeSpanClose(source, openEnd, markerLength);

    // 花括号拆分后 source 与 content 长度不同，但这里统一使用 source 的坐标；
    // 仍保留防御：空游标或倒退时前进一位，避免任何索引错位导致死循环。
    if (markerLength <= 0) {
      result += source.slice(index, codeStart + 1);
      index = codeStart + 1;
      continue;
    }

    if (closeStart === -1) {
      result += source.slice(index, openEnd);
      index = openEnd;
      continue;
    }

    result += source.slice(index, codeStart);
    result += stash(source.slice(codeStart, closeStart + markerLength));
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

      // 未闭合围栏会一直延续到容器末尾，后面的内容不是 HTML 块。
      break;
    }

    const htmlEnd = getHtmlBlockEnd(lines, index);

    if (htmlEnd == null) continue;

    for (let next = index; next <= htmlEnd; next += 1) result.add(next);

    index = htmlEnd;
  }

  return result;
};

/** Markdown 链接 / 图片（含可选 title；允许反引号与花括号，交给 markdown-it 决定是否成链） */
const markdownLinkOrImage =
  /!?\[[^\]\n]*\]\((?:<[^<>\n]*>|[^\s()'"]*)(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?\s*\)/gu;

/** Markdown autolink（scheme URL 或邮箱；允许反引号与花括号） */
const markdownAutolink = /<(?:[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*|[^\s<>@]+@[^\s<>]+)>/gu;

/** 表格分隔行 */
const markdownTableDelimiter = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/u;

/**
 * 记录 GFM 表格各行的行号
 *
 * Markdown-it 的表格解析按单元格独立处理行内内容，反引号不会跨单元格配对； 这里的行内扫描也必须按单元格切分，否则会把 `{{ }}` 误当成代码内容放过。
 *
 * @param lines 全部行
 * @returns 表格行号集合
 */
const collectTableBlockLines = (lines: string[]): Set<number> => {
  const result = new Set<number>();

  for (let index = 1; index < lines.length; index += 1) {
    if (!markdownTableDelimiter.test(lines[index])) continue;

    const start = index - 1;

    if (start < 0 || !lines[start].includes("|")) continue;

    let end = index;

    while (end + 1 < lines.length && lines[end + 1].trim() !== "" && lines[end + 1].includes("|"))
      end += 1;

    for (let next = start; next <= end; next += 1) result.add(next);

    index = end;
  }

  return result;
};

/**
 * 按未转义的 `|` 切分表格行
 *
 * @param line 表格行
 * @returns 单元格片段
 */
const splitTableRow = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "|" && !isEscaped(line, index)) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);

  return cells;
};

/**
 * 标记行首 HTML 注释块所在的行
 *
 * 注释块里的花括号不能用插入注释的方式拆开（会提前终结注释或泄漏注释内容）， 需要改写为字符引用。
 *
 * @param lines 全部行
 * @returns 注释块行号集合
 */
const collectHtmlCommentLines = (lines: string[]): Set<number> => {
  const result = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (!htmlCommentStart.test(stripBlockquotePrefix(lines[index]))) continue;

    const end = findLineWith(lines, index, "-->");
    const commentText = lines
      .slice(index, end + 1)
      .map((line) => stripBlockquotePrefix(line))
      .join("\n");
    const start = commentText.indexOf("<!--");
    const finish = commentText.indexOf("-->", start + 4);

    // 只整体遮蔽合法注释；非法注释在 markdown-it 中是文本，实体编码后会被解码回花括号。
    if (start === -1 || finish === -1 || !isValidHtmlComment(commentText.slice(start, finish + 3)))
      continue;

    for (let next = index; next <= end; next += 1) result.add(next);

    index = end;
  }

  return result;
};

/**
 * 标记原始文本元素所在的行
 *
 * `textarea` / `script` / `style` / `title` 等元素内部按 HTML 规则是文本，标签样式的字符串不会成为元素或属性， 不能按标签遮蔽其中的花括号。
 *
 * @param lines 全部行
 * @returns 原始文本元素行号
 */
const collectHtmlRawTextLines = (lines: string[]): Set<number> => {
  const result = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    const start = htmlRawTextStart.exec(stripBlockquotePrefix(lines[index]));

    if (!start?.groups?.tag) continue;

    const close = new RegExp(String.raw`</${start.groups.tag}\s*>`, "iu");
    let end = lines.length - 1;

    for (let next = index; next < lines.length; next += 1) {
      if (close.test(stripBlockquotePrefix(lines[next]))) {
        end = next;
        break;
      }
    }

    for (let cursor = index; cursor <= end; cursor += 1) result.add(cursor);

    index = end;
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
      // markdown-it 会把未闭合围栏一直当作代码；这里标记到末尾并一律拆开花括号，
      // 不按 v-pre 保留，避免围栏之后的文本被误当成代码。
      for (let next = index; next < lines.length; next += 1) {
        fenceLines.add(next);
        result.push(lines[next]);
      }

      break;
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
  const htmlCommentLines = collectHtmlCommentLines(lines);
  const rawTextLines = collectHtmlRawTextLines(lines);
  const tableBlockLines = collectTableBlockLines(lines);
  const listFenceLines = collectListItemFenceLines(lines, htmlBlockLines);
  const blockquoteFenceLines = collectBlockquoteFenceLines(lines, htmlBlockLines);
  const fenceResult = maskFenceBlocks(lines, htmlBlockLines, listFenceLines, stash);
  const isCodeContext = (index: number, line: string): boolean =>
    listFenceLines.has(index) ||
    blockquoteFenceLines.has(index) ||
    fenceResult.fenceLines.has(index) ||
    isIndentedCodeLine(line);
  const tagMasked = fenceResult.lines
    .map((line, index) =>
      htmlBlockLines.has(index) && !rawTextLines.has(index) && !isCodeContext(index, line)
        ? line.replaceAll(markdownHtmlTag, (match: string, offset: number) =>
            isEscaped(line, offset) ? match : stash(match),
          )
        : line,
    )
    .join("\n");
  // 注释与行内代码按源码顺序处理，避免注释里的反引号与正文反引号错误配对。
  const masked = tagMasked
    .split("\n")
    .map((line, index) => {
      if (htmlCommentLines.has(index))
        // 注释本身不可见，实体编码后整体遮蔽，避免后续把实体再拆成嵌套注释。
        return stash(line.replaceAll("{", "&#123;").replaceAll("}", "&#125;"));

      if (htmlBlockLines.has(index) || rawTextLines.has(index) || isCodeContext(index, line))
        return line;

      // 先遮蔽真实链接（destination/title）与 autolink，再做行内代码配对：
      // markdown-it 不把它们当作行内内容，其中的反引号不能与正文反引号配对。
      const withoutLinks = line
        .replaceAll(markdownLinkOrImage, (match: string, offset: number) => {
          if (isEscaped(line, offset)) return match;

          // 只遮蔽 destination/title；标签文字仍要参与花括号中和。
          const destination = match.indexOf("](") + 1;

          return match.slice(0, destination) + stash(match.slice(destination));
        })
        .replaceAll(markdownAutolink, (match: string, offset: number) => {
          if (isEscaped(line, offset)) return match;

          // autolink 内出现花括号时保留原文交给最终拆分，但其中的反引号不能参与行内代码配对，
          // 否则 `{{ 7*7 }}` 会被当成代码段内容原样留下。
          return /[{}]/u.test(match) ? match.replaceAll("`", (tick) => stash(tick)) : stash(match);
        });

      return tableBlockLines.has(index)
        ? splitTableRow(withoutLinks)
            .map((cell) => maskInlineSyntax(cell, stash, stashComment))
            .join("|")
        : maskInlineSyntax(withoutLinks, stash, stashComment);
    })
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
