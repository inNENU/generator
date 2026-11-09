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
const htmlRawTextStart =
  /<(?<tag>textarea|script|style|title|xmp|iframe|noembed|noframes|plaintext|listing|noscript|template)\b/iu;

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
const stripContainerPrefixes = (line: string): string => {
  let rest = line;

  for (;;) {
    const match = /^(?: {0,3}>[ \t]?| {0,3}(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$))/u.exec(rest);

    if (!match) return rest;

    rest = rest.slice(match[0].length);
  }
};

const isIndentedCodeLine = (line: string): boolean =>
  /^(?: {4}|\t)/u.test(stripContainerPrefixes(line));

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
    /^(?<indent> {0,3})(?:[-+*]|\d{1,9}[.)])(?<spacing>[ \t]+)(?<fenceLine> {0,3}(?:`{3,}|~{3,}).*)$/u.exec(
      stripBlockquotePrefix(line),
    );

  if (!match?.groups?.fenceLine) return null;

  // CommonMark：列表标记后超过 4 列空白属于缩进代码块，不是围栏；tab 按 4 列展开。
  // oxlint-disable-next-line eslint/no-use-before-define -- 常量表定义在文件后部以保持说明性辅助函数顺序
  if (expandLeadingIndent(match.groups.spacing ?? "") > 4) return null;

  return getFenceInfo(match.groups.fenceLine);
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
 * 判断候选行是否与围栏开头匹配
 *
 * @param candidate 候选行的围栏信息
 * @param fence 开头围栏信息
 * @param candidateLine 候选行
 * @returns 是否构成闭合围栏
 */
const isMatchingFenceClose = (
  candidate: ReturnType<typeof getFenceInfo>,
  fence: NonNullable<ReturnType<typeof getFenceInfo>>,
  candidateLine: string,
): boolean =>
  candidate != null &&
  candidate.marker === fence.marker &&
  candidate.length >= fence.length &&
  markdownFenceClose.test(candidateLine);

/**
 * 记录围栏行范围
 *
 * @param target 围栏行号集合与保护标记
 * @param from 起始行
 * @param to 结束行
 */
const addFenceLineRange = (
  target: { lines: Set<number>; protectedLines: Set<number>; vPreProtected: boolean },
  from: number,
  to: number,
): void => {
  for (let cursor = from; cursor <= to; cursor += 1) {
    target.lines.add(cursor);
    if (target.vPreProtected) target.protectedLines.add(cursor);
  }
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
/**
 * 计算行首缩进宽度（tab 按 4 列计）
 *
 * @param value 行首空白
 * @returns 缩进宽度
 */
const expandLeadingIndent = (value: string): number => {
  let width = 0;

  for (const char of value) {
    if (char === "\t") width += 4;
    else if (char === " ") width += 1;
    else break;
  }

  return width;
};

/**
 * 计算行首引用块深度
 *
 * @param line 单行文本
 * @returns 引用块层数
 */
const getBlockquoteDepth = (line: string): number => {
  let depth = 0;
  let rest = line;

  for (;;) {
    const match = /^ {0,3}>[ \t]?/u.exec(rest);

    if (!match) return depth;

    depth += 1;
    rest = rest.slice(match[0].length);
  }
};

/**
 * 标记顶层围栏代码块所在的行
 *
 * 围栏内部的文本不会被 Markdown 解析，不能被当作列表项 / 引用块围栏收集， 否则 `:no-v-pre` 等未受保护的围栏内容会被错误保护。
 *
 * @param lines 全部行
 * @param htmlBlockLines 原始 HTML 块行号
 * @returns 顶层围栏行号集合
 */
const collectTopLevelFenceLines = (lines: string[], htmlBlockLines: Set<number>): Set<number> => {
  const result = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (htmlBlockLines.has(index)) continue;

    const fence = getFenceInfo(lines[index]);

    if (!fence) continue;

    // oxlint-disable-next-line eslint/no-use-before-define -- 围栏闭合查找与容器扫描共用同一实现
    const closeIndex = findFenceClose(lines, index, fence);

    if (closeIndex === -1) continue;

    for (let next = index; next <= closeIndex; next += 1) result.add(next);

    index = closeIndex;
  }

  return result;
};

// oxlint-disable-next-line eslint/max-statements -- 列表项围栏需要顺序维护容器缩进与引用深度
const collectListItemFenceLines = (
  lines: string[],
  htmlBlockLines: Set<number>,
  topLevelFenceLines: Set<number>,
  blockquoteFenceLines: Set<number>,
): { lines: Set<number>; protectedLines: Set<number> } => {
  const result = new Set<number>();
  const protectedLines = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (
      htmlBlockLines.has(index) ||
      topLevelFenceLines.has(index) ||
      // 引用块内围栏的正文不会被解析为 Markdown，不能再按列表围栏收集。
      blockquoteFenceLines.has(index)
    )
      continue;

    const fence = getListItemFenceInfo(lines[index]);

    if (!fence) continue;

    const container = /^(?<indent> {0,3})(?<marker>[-+*]|\d{1,9}[.)])(?<spacing>[ \t]+)/u.exec(
      stripBlockquotePrefix(lines[index]),
    );
    const contentIndent = container?.groups
      ? expandLeadingIndent(container.groups.indent ?? "") +
        (container.groups.marker ?? "").length +
        expandLeadingIndent(container.groups.spacing ?? "")
      : 2;
    const vPreProtected = hasFenceVPre(fence.info);
    const quoteDepth = getBlockquoteDepth(lines[index]);

    result.add(index);
    let closed = false;
    let boundary = lines.length;

    for (let next = index + 1; next < lines.length; next += 1) {
      // 引用层数变浅会结束整个引用容器，列表项与围栏也随之结束。
      if (getBlockquoteDepth(lines[next]) < quoteDepth) {
        boundary = next;
        break;
      }

      const rawLine = stripBlockquotePrefix(lines[next]);

      // 空行不结束列表项，围栏可以跨过。
      if (rawLine.trim() !== "") {
        const indent = expandLeadingIndent(rawLine);

        // 非空行未缩进到列表内容列时会结束列表项，围栏也随之结束。
        if (indent < contentIndent) {
          boundary = next;
          break;
        }
      }

      const candidateLine = rawLine.trimStart();
      const candidate = getFenceInfo(candidateLine);

      if (isMatchingFenceClose(candidate, fence, candidateLine)) {
        addFenceLineRange({ lines: result, protectedLines, vPreProtected }, index, next);
        index = next;
        closed = true;
        break;
      }
    }

    if (closed) continue;

    addFenceLineRange({ lines: result, protectedLines, vPreProtected }, index, boundary - 1);

    if (boundary > index + 1) index = boundary - 1;
  }

  return { lines: result, protectedLines };
};

/**
 * 标记引用块或顶层围栏代码块所在的行
 *
 * `desc` 会被逐行加上 `> `，围栏代码块因此不在行首；这些行不能按普通行做标签遮蔽。 引用块可能嵌套多层：只有同级或更深层的引用行才能延续围栏，否则围栏随容器结束。
 *
 * @param lines 全部行
 * @param htmlBlockLines 原始 HTML 块行号
 * @param topLevelFenceLines 顶层围栏行号
 * @param listFenceLines 列表围栏行号（这些行属于列表围栏正文，不能被当成引用块围栏的开头）
 * @returns 围栏代码块行号
 */
const collectBlockquoteFenceLines = (
  lines: string[],
  htmlBlockLines: Set<number>,
  topLevelFenceLines: Set<number>,
  listFenceLines: Set<number>,
): { lines: Set<number>; protectedLines: Set<number> } => {
  const result = new Set<number>();
  const protectedLines = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (
      htmlBlockLines.has(index) ||
      topLevelFenceLines.has(index) ||
      // 列表围栏正文不会被解析；其中的行不能被当成引用块围栏的开头。
      listFenceLines.has(index)
    )
      continue;

    const fence = getFenceInfo(stripBlockquotePrefix(lines[index]));

    if (!fence) continue;

    const depth = getBlockquoteDepth(lines[index]);
    const vPreProtected = hasFenceVPre(fence.info);

    result.add(index);
    let closed = false;
    let boundary = lines.length;

    for (let next = index + 1; next < lines.length; next += 1) {
      if (getBlockquoteDepth(lines[next]) < depth) {
        boundary = next;
        break;
      }

      const candidateLine = stripBlockquotePrefix(lines[next]).trimStart();
      const candidate = getFenceInfo(candidateLine);

      if (isMatchingFenceClose(candidate, fence, candidateLine)) {
        addFenceLineRange({ lines: result, protectedLines, vPreProtected }, index, next);
        index = next;
        closed = true;
        break;
      }
    }

    if (closed) continue;

    addFenceLineRange({ lines: result, protectedLines, vPreProtected }, index, boundary - 1);

    if (boundary > index + 1) index = boundary - 1;
  }

  return { lines: result, protectedLines };
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

  // 反斜杠只转义第一个反引号，其后的反引号仍可开启代码段；
  // 因此这里只前进一个字符，不能跳过整段反引号串。
  while (start !== -1 && isEscaped(content, start)) start = content.indexOf("`", start + 1);

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

// oxlint-disable eslint/max-lines -- 插值中和的遮蔽顺序需要共享内部状态，拆分文件只会增加跨文件耦合
// oxlint-disable eslint/max-lines-per-function -- 同上，跨行扫描与遮蔽必须在同一函数内维护顺序
// oxlint-disable eslint/max-statements -- 跨行扫描需要顺序维护段落、行偏移与代码段状态

const splitVueBraceRuns = (value: string): string =>
  value
    .replaceAll(vueInterpolationOpenRun, (run) => splitVueBraceRun(run, vueInterpolationOpenAtom))
    .replaceAll(vueInterpolationCloseRun, (run) =>
      splitVueBraceRun(run, vueInterpolationCloseAtom),
    );

/**
 * 转义 `plaintext` 标签
 *
 * `plaintext` 是废弃的原始文本元素，Vue 编译器会把它当作缺少结束标签的原始文本元素。
 *
 * @param value 可能包含 `plaintext` 标签的文本
 * @returns 转义后的文本
 */
const escapePlaintextTags = (value: string): string =>
  value.replaceAll(/<\/?plaintext\b/giu, (tag) => `&lt;${tag.slice(1)}`);

/**
 * 判断 autolink 解码后是否可能出现花括号
 *
 * @param value Autolink 源文本
 * @returns 是否包含解码后可能还原成花括号的内容
 */
const hasBraceLikeAutolinkContent = (value: string): boolean =>
  /[{}]/u.test(value) ||
  /%(?:7[bB]|7[dD])/u.test(value) ||
  /&#(?:0*123|x0*7[bB]);/iu.test(value) ||
  /&(?:l|r)brace;/iu.test(value) ||
  /&(?:l|r)cub;/iu.test(value);

/**
 * 清洗 autolink，使其在 markdown-it 解码后仍不包含花括号
 *
 * 同时移除会干扰代码段配对的反引号。
 *
 * @param match Autolink 源文本
 * @returns 清理后的文本
 */
const sanitizeAutolink = (match: string): string => {
  const safe = hasBraceLikeAutolinkContent(match)
    ? match
        .replaceAll("%", "%25")
        .replaceAll("{", "%257B")
        .replaceAll("}", "%257D")
        .replaceAll("&", "&amp;")
    : match;

  return safe.replaceAll("`", "%60");
};

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
    const nextLt = source.indexOf("<", index);
    const tag = nextLt === -1 ? null : findHtmlTag(source, nextLt);

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
      const tagText = source.slice(tag.index, tag.index + tag.length);

      result += source.slice(index, tag.index);
      result += stash(/^<\/?plaintext\b/iu.test(tagText) ? escapePlaintextTags(tagText) : tagText);
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
 * 判断指定位置是否落在行内代码片段中
 *
 * 原始文本元素只在行内代码之外生效；代码片段中的 `<template>` 等文本不应改变代码原文。
 *
 * @param line 单行内容
 * @param position 字符下标
 * @returns 是否位于行内代码中
 */
const isInsideInlineCode = (line: string, position: number): boolean => {
  let from = 0;

  while (from < line.length) {
    const start = findCodeSpanStart(line, from);

    if (start === -1 || start > position) return false;

    const markerEnd = getBacktickRunEnd(line, start);
    const close = findCodeSpanClose(line, markerEnd, markerEnd - start);

    if (close === -1) return false;

    const closeEnd = getBacktickRunEnd(line, close);

    if (position >= markerEnd && position < closeEnd) return true;

    from = closeEnd;
  }

  return false;
};

/**
 * 收集单行内的行内代码区间
 *
 * @param line 单行内容
 * @returns 行内代码的起止区间（升序）
 */
const collectInlineCodeRanges = (line: string): { start: number; end: number }[] => {
  const ranges: { start: number; end: number }[] = [];
  let index = 0;

  while (index < line.length) {
    const start = findCodeSpanStart(line, index);

    if (start === -1) break;

    const markerEnd = getBacktickRunEnd(line, start);
    const close = findCodeSpanClose(line, markerEnd, markerEnd - start);

    if (close === -1) {
      index = markerEnd;
      continue;
    }

    const closeEnd = getBacktickRunEnd(line, close);
    ranges.push({ start, end: closeEnd });
    index = closeEnd;
  }

  return ranges;
};

/**
 * 标记原始文本元素所在的行
 *
 * `textarea` / `script` / `style` / `title` 等元素内部按 HTML 规则是文本，标签样式的字符串不会成为元素或属性， 不能按标签遮蔽其中的花括号。
 *
 * @param lines 全部行
 * @returns 各行对应的原始文本元素标签
 */
const collectHtmlRawTextLines = (lines: string[]): Map<number, string> => {
  const result = new Map<number, string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = stripBlockquotePrefix(lines[index]);
    const starts = [...line.matchAll(new RegExp(htmlRawTextStart.source, "giu"))];
    const start = starts.find((match) => !isInsideInlineCode(line, match.index ?? 0));

    if (!start?.groups?.tag) continue;

    const close = new RegExp(String.raw`</${start.groups.tag}\s*>`, "iu");
    let end = lines.length - 1;

    for (let next = index; next < lines.length; next += 1) {
      if (close.test(stripBlockquotePrefix(lines[next]))) {
        end = next;
        break;
      }
    }

    for (let cursor = index; cursor <= end; cursor += 1)
      result.set(cursor, start.groups.tag.toLowerCase());

    index = end;
  }

  return result;
};

/**
 * 记录跨行行内代码的字符区间
 *
 * CommonMark 的行内代码可以跨行；逐行配对会把闭合反引号与后续反引号错配， 使花括号被误当成代码内容而逃过中和。
 *
 * @param lines 全部行
 * @param isCandidate 该行是否按行内内容处理
 * @returns 每行需遮蔽的区间（升序）
 */
const collectMultiLineCodeSpans = (
  lines: string[],
  isCandidate: (index: number) => boolean,
): Map<number, { start: number; end: number }[]> => {
  const spans = new Map<number, { start: number; end: number }[]>();
  let index = 0;

  while (index < lines.length) {
    if (!isCandidate(index) || lines[index].trim() === "") {
      index += 1;
      continue;
    }

    let paragraphEnd = index;

    while (
      paragraphEnd + 1 < lines.length &&
      isCandidate(paragraphEnd + 1) &&
      lines[paragraphEnd + 1].trim() !== ""
    )
      paragraphEnd += 1;

    const offsets: number[] = [];
    let text = "";

    for (let lineIndex = index; lineIndex <= paragraphEnd; lineIndex += 1) {
      offsets.push(text.length);
      text += lines[lineIndex];
      if (lineIndex < paragraphEnd) text += "\n";
    }

    const locate = (offset: number): { line: number; column: number } => {
      let lineIndex = 0;

      while (lineIndex < offsets.length - 1 && offsets[lineIndex + 1] <= offset) lineIndex += 1;

      return { line: lineIndex, column: offset - offsets[lineIndex] };
    };

    let search = 0;

    while (search < text.length) {
      const codeStart = findCodeSpanStart(text, search);

      if (codeStart === -1) break;

      const openEnd = getBacktickRunEnd(text, codeStart);
      const markerLength = openEnd - codeStart;
      const closeStart = findCodeSpanClose(text, openEnd, markerLength);

      if (closeStart === -1) break;

      const closeEnd = closeStart + markerLength;
      const startPosition = locate(codeStart);
      const endPosition = locate(closeEnd);

      if (startPosition.line !== endPosition.line) {
        for (let lineIndex = startPosition.line; lineIndex <= endPosition.line; lineIndex += 1) {
          const lineStart = lineIndex === startPosition.line ? startPosition.column : 0;
          const lineEnd =
            lineIndex === endPosition.line
              ? endPosition.column
              : (offsets[lineIndex + 1] ?? text.length) - offsets[lineIndex] - 1;
          const ranges = spans.get(index + lineIndex) ?? [];

          ranges.push({ start: lineStart, end: lineEnd });
          spans.set(index + lineIndex, ranges);
        }
      }

      search = closeEnd;
    }

    index = paragraphEnd + 1;
  }

  return spans;
};

/**
 * 按行遮蔽跨行行内代码
 *
 * @param lines 全部行
 * @param isCandidate 该行是否按行内内容处理
 * @param stash 遮蔽函数
 * @returns 逐行结果
 */
const maskMultiLineCodeSpans = (
  lines: string[],
  isCandidate: (index: number) => boolean,
  stash: (value: string) => string,
): string[] => {
  const spans = collectMultiLineCodeSpans(lines, isCandidate);
  const result = [...lines];

  for (const [lineIndex, ranges] of spans) {
    let line = result[lineIndex];

    for (const range of [...ranges].sort((left, right) => right.start - left.start)) {
      line =
        line.slice(0, range.start) +
        stash(line.slice(range.start, range.end)) +
        line.slice(range.end);
    }

    result[lineIndex] = line;
  }

  return result;
};

/** Markdown 引用式链接定义（`[ref]: destination`，含引用块前缀） */
const markdownReferenceDefinition =
  /^(?<prefix>(?:[ \t]*>[ \t]?)*[ \t]*\[[^\]\n]+\]:[ \t]*)(?<destination><[^<>\n]*>|[^\s]+)(?<rest>.*)$/u;

/**
 * 转义引用式链接目标中的花括号，保持 URL 语义
 *
 * @param destination 链接目标
 * @returns 处理后的链接目标
 */
const sanitizeReferenceDestination = (destination: string): string =>
  /[{}`]/u.test(destination)
    ? destination.replaceAll("{", "%7B").replaceAll("}", "%7D").replaceAll("`", "%60")
    : destination;

/**
 * 遮蔽围栏代码块
 *
 * @param lines 全部行
 * @param htmlBlockLines 原始 HTML 块行号
 * @param fenceInfo 列表项与引用块围栏信息
 * @param stash 遮蔽函数
 * @returns 逐行结果
 */
/**
 * 合并列表项与引用块围栏的保护范围
 *
 * 两类收集器可能把同一个围栏区域识别成不同容器（例如列表围栏正文里形似围栏的行）。 真实 Markdown 中外层围栏先开始、内部文本不再解析，因此按起点最早的候选决定保护状态。
 *
 * @param fenceInfos 各收集器的围栏行与受保护行
 * @returns 行号到是否受 v-pre 保护的映射
 */
const resolveContainerFenceProtection = (
  fenceInfos: { lines: Set<number>; protectedLines: Set<number> }[],
): Map<number, boolean> => {
  const ranges: { start: number; end: number; protect: boolean }[] = [];

  for (const info of fenceInfos) {
    const sorted = [...info.lines].sort((left, right) => left - right);

    for (let cursor = 0; cursor < sorted.length; cursor += 1) {
      const start = sorted[cursor];
      let end = start;

      while (cursor + 1 < sorted.length && sorted[cursor + 1] === end + 1) {
        cursor += 1;
        end = sorted[cursor];
      }

      ranges.push({ start, end, protect: info.protectedLines.has(start) });
    }
  }

  // 起点更晚的候选先写入、起点更早的候选后覆盖，从而让最外层围栏胜出。
  ranges.sort((left, right) => right.start - left.start);

  const result = new Map<number, boolean>();

  for (const range of ranges)
    for (let index = range.start; index <= range.end; index += 1) result.set(index, range.protect);

  return result;
};

const maskFenceBlocks = (
  lines: string[],
  htmlBlockLines: Set<number>,
  containerProtection: Map<number, boolean>,
  stash: (value: string) => string,
): { lines: string[]; fenceLines: Set<number> } => {
  const result: string[] = [];
  const fenceLines = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (htmlBlockLines.has(index)) {
      result.push(line);
      continue;
    }

    // 列表项与引用块内的围栏在 VuePress 下同样有 v-pre（除非显式 :no-v-pre），
    // 必须原样保留；未受保护的围栏交给后续全局拆分。
    if (containerProtection.has(index)) {
      result.push(containerProtection.get(index) ? stash(line) : line);
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
  const topLevelFenceLines = collectTopLevelFenceLines(lines, htmlBlockLines);
  // 列表围栏与引用块围栏可能互相包含对方形态的行；两类收集器交替剔除对方的命中行，
  // 直到稳定，避免「围栏正文里的闭合行被当作新围栏开头」这类误判。
  let blockquoteFenceInfo = {
    lines: new Set<number>(),
    protectedLines: new Set<number>(),
  };
  let listFenceInfo = {
    lines: new Set<number>(),
    protectedLines: new Set<number>(),
  };

  for (let round = 0; round < 3; round += 1) {
    const nextList = collectListItemFenceLines(
      lines,
      htmlBlockLines,
      topLevelFenceLines,
      blockquoteFenceInfo.lines,
    );
    const nextBlockquote = collectBlockquoteFenceLines(
      lines,
      htmlBlockLines,
      topLevelFenceLines,
      nextList.lines,
    );
    const stable =
      nextList.lines.size === listFenceInfo.lines.size &&
      nextBlockquote.lines.size === blockquoteFenceInfo.lines.size;

    listFenceInfo = nextList;
    blockquoteFenceInfo = nextBlockquote;

    if (stable) break;
  }

  const containerProtection = resolveContainerFenceProtection([listFenceInfo, blockquoteFenceInfo]);
  const fenceResult = maskFenceBlocks(lines, htmlBlockLines, containerProtection, stash);
  const isCodeContext = (index: number, line: string): boolean =>
    listFenceInfo.lines.has(index) ||
    blockquoteFenceInfo.lines.has(index) ||
    fenceResult.fenceLines.has(index) ||
    isIndentedCodeLine(line);
  const tagMasked = fenceResult.lines
    .map((line, index) =>
      htmlBlockLines.has(index) && !rawTextLines.has(index) && !isCodeContext(index, line)
        ? line.replaceAll(markdownHtmlTag, (match: string, offset: number) =>
            isEscaped(line, offset)
              ? match
              : stash(/^<\/?plaintext\b/iu.test(match) ? escapePlaintextTags(match) : match),
          )
        : line,
    )
    .join("\n");
  const taggedLines = tagMasked.split("\n");
  // 跨行行内代码先逐行遮蔽，避免逐行配对时的反引号错配。
  const multiLineMaskedLines = maskMultiLineCodeSpans(
    taggedLines,
    (index) =>
      !isCodeContext(index, taggedLines[index]) &&
      !htmlBlockLines.has(index) &&
      !htmlCommentLines.has(index) &&
      !rawTextLines.has(index) &&
      !tableBlockLines.has(index) &&
      // 文本组件会转义 HTML；这类行里的反引号是普通字符，按保守策略仍逐行中和。
      !/[&](?:gt|lt|quot);/u.test(taggedLines[index]),
    stash,
  );
  // 注释与行内代码按源码顺序处理，避免注释里的反引号与正文反引号错误配对。
  const masked = multiLineMaskedLines
    .map((line, index) => {
      if (isIndentedCodeLine(line)) return splitVueBraceRuns(line);

      if (htmlCommentLines.has(index))
        // 注释本身不可见，实体编码后整体遮蔽，避免后续把实体再拆成嵌套注释。
        return stash(line.replaceAll("{", "&#123;").replaceAll("}", "&#125;"));

      if (isCodeContext(index, line)) return line;

      if (rawTextLines.has(index)) {
        return rawTextLines.get(index) === "plaintext"
          ? splitVueBraceRuns(escapePlaintextTags(line))
          : line;
      }

      if (htmlBlockLines.has(index))
        return /<\/?plaintext\b/iu.test(line) ? splitVueBraceRuns(escapePlaintextTags(line)) : line;

      // 引用式链接定义的 URL 不能拆开花括号，否则定义失效；改为百分号编码。
      const withoutReferences = line.replace(
        markdownReferenceDefinition,
        (_, prefix: string, destination: string, rest: string) =>
          prefix + sanitizeReferenceDestination(destination) + rest,
      );

      // 行内代码优先于链接解析：与行内代码重叠的伪链接不能先遮蔽，
      // 否则其中的反引号会被移出，使代码段配对错位、正文花括号逃过中和。
      const inlineCodeRanges = collectInlineCodeRanges(withoutReferences);
      // 只有链接起点落在更早开始的行内代码段内时，才是 markdown-it 会先解析为代码的伪链接；
      // 若链接起点在代码段之前（如 autolink 内出现反引号），markdown-it 仍会解析该链接，必须遮蔽。
      const startsInsideInlineCode = (offset: number): boolean =>
        inlineCodeRanges.some((range) => range.start < offset && offset < range.end);

      // 先遮蔽真实链接（destination/title）与 autolink，再做行内代码配对：
      // markdown-it 不把它们当作行内内容，其中的反引号不能与正文反引号配对。
      const withoutLinks = withoutReferences
        .replaceAll(markdownLinkOrImage, (match: string, offset: number) => {
          if (isEscaped(withoutReferences, offset) || startsInsideInlineCode(offset)) return match;

          // 只遮蔽 destination/title；标签文字仍要参与花括号中和。
          const destination = match.indexOf("](") + 1;

          return match.slice(0, destination) + stash(match.slice(destination));
        })
        .replaceAll(markdownAutolink, (match: string, offset: number) => {
          if (isEscaped(withoutReferences, offset) || startsInsideInlineCode(offset)) return match;

          // autolink 的可见文字会被 markdown-it 解码，其中的反引号也会破坏正文代码段配对；
          // 先清洗再加遮蔽，避免解码后重新出现 {{ }} 或反引号。
          return stash(sanitizeAutolink(match));
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
  const escaped = restore(
    masked
      .replaceAll(vueInterpolationOpenRun, (run) => splitVueBraceRun(run, vueInterpolationOpenAtom))
      .replaceAll(vueInterpolationCloseRun, (run) =>
        splitVueBraceRun(run, vueInterpolationCloseAtom),
      ),
  );

  return escaped;
};
