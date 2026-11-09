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

/** 会被 HTML/Markdown 解码成花括号的实体 */
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
export const escapeVueInterpolation = (value: string): string =>
  neutralizeDecodedBraces(value)
    .split("\n")
    .map((line) => splitVueBraceRuns(line))
    .join("\n");
