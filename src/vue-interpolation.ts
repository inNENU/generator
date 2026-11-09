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

/** 会被 HTML/Markdown 解码成花括号的实体（含大小写十六进制、左右花括号与多层 `&amp;` 前缀） */
const decodedBracePattern =
  /&(?:amp;)*(?:#(?:0*(?:123|125)|x0*7(?:[bB]|[dD]))|l(?:cub|brace)|r(?:cub|brace));/giu;

/**
 * 中和会被后续解码还原成花括号的实体
 *
 * 实体在 Markdown、@mdit/plugin-figure 等插件以及 Vue 编译过程中可能被多次解码，仅再加一层 `&amp;` 不足以覆盖 全部解码链。这里直接把实体改写成「花括号 +
 * HTML 注释」，无论解码多少次都只会得到被注释隔开的单个花括号。
 *
 * @param value 原始 Markdown
 * @returns 不会解码出 `{{` / `}}` 的 Markdown
 */
const neutralizeDecodedBraces = (value: string): string =>
  value
    .replaceAll(decodedBracePattern, (match) => {
      const entity = match.replace(/^&(?:amp;)*/iu, "");
      const isOpenBrace = /^(?:#0*123|#x0*7b|l(?:cub|brace));$/iu.test(entity);

      return isOpenBrace ? "{<!-- -->" : "}<!-- -->";
    })
    .replaceAll(encodedBracePattern, (match) => `%25${match.slice(1)}`)
    .replaceAll(/<\/?plaintext\b/giu, (tag) => `&lt;${tag.slice(1)}`);

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

    const repeated = Math.floor((end - index) / 2);
    const backslashes = String.fromCodePoint(0x5c).repeat(repeated * 2);

    result += `${backslashes}${brace}`;
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
