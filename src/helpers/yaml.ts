import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import type { Schema } from "js-yaml";
import { JSON_SCHEMA, NOT_RESOLVED, defineScalarTag, intJsonTag, load } from "js-yaml";
import { isAbsolute, normalize, resolve, relative, dirname, join } from "upath";

import { getFileList } from "./getFileList.js";
import type { FileMapItem } from "./getFileMap.js";
import { getFileMap } from "./getFileMap.js";

/** 单个 YAML 文档允许的最大别名节点数 */
const MAX_YAML_ALIASES = 100;

/** 单个 YAML 文档展开后允许访问的最大节点数，用于阻止别名指数膨胀 */
const MAX_YAML_EXPANDED_NODES = 100_000;

/**
 * 校验解析结果可以安全序列化
 *
 * 别名会被 js-yaml 解析为共享引用，正常的重复引用可以复用；但自引用会形成环（`JSON.stringify` 会抛错）， 嵌套别名还可能指数级展开（俗称 YAML
 * 别名炸弹）。这里在返回前做一次带上限的展开遍历。
 *
 * @param value 解析结果
 * @param filePath 文件路径，仅用于错误信息
 */
const assertYamlValueSafe = (value: unknown, filePath: string): void => {
  const ancestors = new Set<object>();
  let visited = 0;

  const visit = (node: unknown): void => {
    visited += 1;

    if (visited > MAX_YAML_EXPANDED_NODES)
      throw new Error(`YAML 文档展开后过大，可能存在别名炸弹（文件: ${filePath}）`);

    if (typeof node !== "object" || node == null) return;

    if (ancestors.has(node)) throw new Error(`YAML 文档存在循环引用（文件: ${filePath}）`);

    ancestors.add(node);

    if (Array.isArray(node)) for (const item of node) visit(item);
    else for (const item of Object.values(node)) visit(item);

    ancestors.delete(node);
  };

  visit(value);
};

/** JavaScript 安全整数上限，超出该范围的整数无法用 `number` 精确表示 */
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * 对超出 JavaScript 安全整数范围的整数原文打印告警
 *
 * @param source 整数原文
 * @param filePath 文件路径，仅用于告警信息
 */
const warnIfUnsafeInteger = (source: string, filePath: string): void => {
  const signless = source.replaceAll("_", "").replace(/^[+-]/u, "");
  const negative = source.startsWith("-");
  let value: bigint;

  try {
    value = BigInt(signless);
  } catch {
    // 不是合法的整数原文（例如显式标签匹配到的其它写法），交给解析器自行处理
    return;
  }

  if (negative) value = -value;
  if (value >= -MAX_SAFE_INTEGER_BIGINT && value <= MAX_SAFE_INTEGER_BIGINT) return;

  const location = filePath ? `（文件: ${filePath}）` : "";

  console.warn(
    `YAML 大整数超出安全整数范围，解析为 number 时可能丢失精度${location}: ${source}；长数字请加引号，以按字符串保留原始值`,
  );
};

/**
 * 创建带大整数告警的 YAML schema
 *
 * 在 js-yaml 默认 JSON schema 的基础上替换整数标签：仍按原逻辑解析，但整数超出 JavaScript 安全整数范围时打印告警，避免静默丢失精度。
 *
 * @param filePath 文件路径，仅用于告警信息
 * @returns 用于本次解析的 schema
 */
const createYamlSchema = (filePath: string): Schema =>
  JSON_SCHEMA.withTags(
    defineScalarTag<number>("tag:yaml.org,2002:int", {
      implicit: true,
      implicitFirstChars: ["-", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
      identify: intJsonTag.identify,
      represent: intJsonTag.represent,
      resolve: (source, isExplicit, tagName) => {
        const value = intJsonTag.resolve(source, isExplicit, tagName);

        if (value !== NOT_RESOLVED) warnIfUnsafeInteger(source, filePath);

        return value;
      },
    }),
  );

/**
 * 匹配位于第 0 列的文档标记行（`---`、`...`）
 *
 * 按 YAML 规范，文档标记必须从第 0 列开始，后面只允许空白或注释；缩进的 `...`/`---` 属于普通标量，不是文档标记。
 */
const yamlDocumentMarkerPattern = /^(?:---|\.\.\.)(?:\s+(?:#.*)?)?$/u;

/**
 * 判断 YAML 内容是否包含实际文档
 *
 * 空行、注释、文档标记（`---`/`...`）与指令（`%YAML`/`%TAG`）都不构成文档内容，只有这些行的文件按空文档处理。 由于文档标记与指令必须位于第 0 列，缩进的
 * `...`、`---` 会被当作普通标量内容，缩进的 `%foo` 也不再被误判为空文档。
 *
 * @param content YAML 内容
 * @returns 是否包含实际标量内容
 */
const hasYamlDocument = (content: string): boolean => {
  // 去掉文件开头的 BOM，避免首行的文档标记被当成普通内容
  const normalizedContent = content.startsWith("\uFEFF") ? content.slice(1) : content;

  return normalizedContent.split("\n").some((line) => {
    if (line.trim() === "") return false;
    if (line.trimStart().startsWith("#")) return false;
    if (line.startsWith("%")) return false;

    return !yamlDocumentMarkerPattern.test(line);
  });
};

/**
 * 解析 YAML 内容
 *
 * 空文件、仅包含注释、或仅包含文档标记/指令时返回 `undefined`；解析失败时抛出带文件路径的中文错误，便于定位批量转换中的具体文件。 未加引号的整数超出 JavaScript
 * 安全整数范围时会打印告警：解析结果仍是 `number`，但可能已丢失精度，需要保留原始值时请加引号按字符串处理。
 *
 * @param content YAML 内容
 * @param filePath 文件路径，仅用于错误与告警信息
 * @returns 解析结果，无标量文档为 `undefined`
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const parseYaml = <T = unknown>(content: string, filePath = ""): T | undefined => {
  if (!hasYamlDocument(content)) return void 0;

  try {
    const value = load(content, {
      maxAliases: MAX_YAML_ALIASES,
      schema: createYamlSchema(filePath),
    }) as T | undefined;

    if (value !== void 0) assertYamlValueSafe(value, filePath);

    return value;
  } catch (err) {
    const location = filePath ? `（文件: ${filePath}）` : "";

    throw new Error(
      `YAML 解析失败${location}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
};

/**
 * 匹配会被 YAML 解析成非字符串的纯标量
 *
 * 例如 `123`、`true`、`null`、`0x1A`、`2024-01-01` 直接写进 frontmatter 会变成 number/boolean/null/Date。
 */
const ambiguousScalarPattern =
  /^(?:~|null|true|false|yes|no|on|off|[-+]?(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|0x[\da-f]+|0o[0-7]+|0b[01]+|[-+]?\.(?:inf|nan)|\d{4}-\d{2}-\d{2}(?:[Tt ].*)?)$/iu;

/**
 * 获取 YAML 值
 *
 * @param content 内容
 * @returns 处理后的 YAML 值
 */
export const getYamlValue = (content: string): string => {
  const needsQuote =
    content.length > 0 &&
    (/^[@#?!&*%|>{}[\]"',`]/u.test(content) ||
      /^[-?:](?:\s|$)/u.test(content) ||
      /:\s| #|:$/u.test(content) ||
      /[\r\n]/u.test(content) ||
      /^\s|\s$/u.test(content) ||
      ambiguousScalarPattern.test(content));

  return needsQuote
    ? `"${content
        .replaceAll("\\", String.raw`\\`)
        .replaceAll('"', String.raw`\"`)
        .replaceAll("\r", String.raw`\r`)
        .replaceAll("\n", String.raw`\n`)}"`
    : content;
};

/**
 * 检查源文件夹下的所有 YAML 文件
 *
 * @param sourceFolder 源文件夹
 * @param checker 检查函数，接收解析后的数据与文件路径
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const checkYamlFiles = <T = unknown>(
  sourceFolder: string,
  checker: (data: T, filePath: string) => void,
): void => {
  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const content = readFileSync(resolve(sourceFolder, filePath), {
      encoding: "utf-8",
    });
    const absolutePath = resolve(sourceFolder, filePath);
    const json = parseYaml<T>(content, absolutePath);

    if (json === void 0) {
      console.warn(`空 YAML 文件已跳过: ${absolutePath}`);
      return;
    }

    checker(json, relative("./", filePath.replace(/\.yml$/u, "")));
  });
};

/**
 * 原子写入文件：先写临时文件再 rename，避免中途失败留下半截内容
 *
 * @param filename 目标文件路径
 * @param content 文件内容
 */
const writeFileAtomically = (filename: string, content: string): void => {
  const tempFilename = `${filename}.${process.pid}.tmp`;

  try {
    writeFileSync(tempFilename, content, { encoding: "utf-8" });
    renameSync(tempFilename, filename);
  } catch (err) {
    rmSync(tempFilename, { force: true });
    throw err;
  }
};

/** 生成清单文件名前缀 */
const GENERATION_MANIFEST_PREFIX = ".innenu-generated.";

/** 生成清单格式版本 */
const GENERATION_MANIFEST_VERSION = 1;

/**
 * 判断文件名是否为生成清单
 *
 * 清单固定放在目标文件夹根目录，因此带目录分隔符的路径不视为清单。
 *
 * @param filename 文件名或相对路径
 * @returns 是否为生成清单
 */
const isGenerationManifest = (filename: string): boolean =>
  !filename.includes("/") &&
  filename.startsWith(GENERATION_MANIFEST_PREFIX) &&
  filename.endsWith(".json");

/**
 * 获取路径的真实路径
 *
 * 同一个物理目录可能通过符号链接、`/var` 与 `/private/var` 等别名访问。生成清单按真实路径命名，
 * 避免同一份源在同一目标下写出两个清单：两个清单会互相保护，导致陈旧输出永远清不掉。
 *
 * 路径不存在（例如源文件夹刚被删除）时回退到 `resolve`，保证函数不会抛错。
 *
 * @param filePath 原始路径
 * @returns 真实路径或规范化后的绝对路径
 */
const getCanonicalPath = (filePath: string): string => {
  const absolutePath = resolve(filePath);

  try {
    return realpathSync(absolutePath);
  } catch {
    return absolutePath;
  }
};

/**
 * 获取某个（源文件夹、目标扩展名）组合的生成清单文件名
 *
 * 文件名带源文件夹真实路径与扩展名的哈希，保证多个源共用同一目标文件夹时各用各的清单，不会互相覆盖或按对方的清单清理。 同一个物理源经符号链接或 `/var` 别名访问时仍指向同一个清单。
 *
 * @param sourceFolder 源文件夹
 * @param extension 目标文件扩展名
 * @returns 目标文件夹根目录下的清单文件名
 */
const getGenerationManifestName = (sourceFolder: string, extension: ".json" | ".md"): string => {
  const sourceHash = createHash("sha256")
    .update(`${getCanonicalPath(sourceFolder)}\0${extension}`)
    .digest("hex")
    .slice(0, 16);

  return `${GENERATION_MANIFEST_PREFIX}${extension.slice(1)}.${sourceHash}.json`;
};

/**
 * 把 YAML 相对路径映射为目标输出相对路径
 *
 * Markdown 沿用站点约定：`index.yml` 输出为 `README.md`。
 *
 * @param filePath 源 YAML 相对路径
 * @param extension 目标文件扩展名
 * @returns 目标文件相对路径
 */
const getOutputRelativePath = (filePath: string, extension: ".json" | ".md"): string =>
  extension === ".md"
    ? filePath.replace(/\.yml$/u, ".md").replace(/(?<sep>\/|^)index\.md$/u, "$<sep>README.md")
    : filePath.replace(/\.yml$/u, ".json");

/**
 * 规范化生成清单中的相对路径
 *
 * 拒绝空路径、绝对路径与越出目标文件夹的路径，避免被篡改的清单把删除操作引到目标文件夹之外。
 *
 * @param filePath 清单中的原始路径
 * @returns 规范化后的相对路径，不安全时返回 `undefined`
 */
const normalizeGenerationPath = (filePath: unknown): string | undefined => {
  if (typeof filePath !== "string" || filePath === "" || filePath.includes("\0")) return void 0;

  const normalizedPath = normalize(filePath);

  if (
    normalizedPath === "." ||
    normalizedPath === ".." ||
    normalizedPath.startsWith("../") ||
    isAbsolute(normalizedPath)
  )
    return void 0;

  return normalizedPath;
};

/**
 * 判断路径是否严格位于文件夹内
 *
 * @param folder 文件夹
 * @param filename 文件路径
 * @returns 是否位于文件夹内
 */
const isInsideFolder = (folder: string, filename: string): boolean => {
  const relativePath = relative(folder, filename);

  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith("../") &&
    !isAbsolute(relativePath)
  );
};

/**
 * 读取生成清单
 *
 * 清单损坏或格式不符时返回 `undefined`，调用方据此按“首次运行”保守处理，不做任何删除。
 *
 * @param filename 清单文件路径
 * @returns 排序后的相对路径列表，无法读取时返回 `undefined`
 */
const readGenerationManifest = (filename: string): string[] | undefined => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(filename, { encoding: "utf-8" }));
  } catch (err) {
    console.warn(
      `无法读取生成清单，本次不会清理陈旧输出: ${filename}（${err instanceof Error ? err.message : String(err)}）`,
    );
    return void 0;
  }

  if (
    typeof parsed !== "object" ||
    parsed == null ||
    (parsed as { version?: unknown }).version !== GENERATION_MANIFEST_VERSION ||
    !Array.isArray((parsed as { files?: unknown }).files)
  ) {
    console.warn(`生成清单格式无效，本次不会清理陈旧输出: ${filename}`);
    return void 0;
  }

  const files = new Set<string>();

  for (const filePath of (parsed as { files: unknown[] }).files) {
    const normalizedPath = normalizeGenerationPath(filePath);

    if (!normalizedPath) {
      console.warn(`生成清单包含无效路径，本次不会清理陈旧输出: ${filename}`);
      return void 0;
    }

    files.add(normalizedPath);
  }

  return [...files].sort();
};

/**
 * 写入生成清单
 *
 * 内容排序固定，便于 diff；写入方式与输出文件一致，先写临时文件再 rename。
 *
 * @param filename 清单文件路径
 * @param files 本次生成的相对路径列表
 */
const writeGenerationManifest = (filename: string, files: readonly string[]): void => {
  const content = `${JSON.stringify({ version: GENERATION_MANIFEST_VERSION, files }, null, 2)}\n`;

  try {
    if (readFileSync(filename, { encoding: "utf-8" }) === content) return;
  } catch {
    // 清单不存在或暂时不可读时继续写入
  }

  writeFileAtomically(filename, content);
};

/**
 * 获取目标文件夹中已有的输出文件，用于首次运行时决定是否需要告警
 *
 * 使用 `Dirent`（不跟随符号链接）遍历，只统计目标扩展名的普通文件，并跳过本次已经生成的文件。
 *
 * @param folder 当前遍历的文件夹
 * @param extension 目标文件扩展名
 * @param rootFolder 目标文件夹根目录
 * @param excludedFiles 本次已经生成、无需告警的相对路径
 * @returns 是否存在本次未生成的输出文件
 */
const hasOutputFiles = (
  folder: string,
  extension: ".json" | ".md",
  rootFolder = folder,
  excludedFiles: ReadonlySet<string> = new Set(),
): boolean => {
  let entries;

  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch {
    return false;
  }

  return entries.some((entry) => {
    if (entry.isSymbolicLink()) return false;

    if (entry.isDirectory())
      return hasOutputFiles(resolve(folder, entry.name), extension, rootFolder, excludedFiles);

    if (!entry.isFile() || !entry.name.endsWith(extension) || isGenerationManifest(entry.name))
      return false;

    return !excludedFiles.has(relative(rootFolder, resolve(folder, entry.name)));
  });
};

/**
 * 收集其它生成清单中记录的文件
 *
 * 多个源共用同一目标文件夹时，即使不同源恰好映射到同一相对路径，也不能由其中一个源把另一个源仍在生成的文件删掉。
 *
 * 只要存在无法读取或格式无效的其它清单，就无法确认它保护了哪些路径，调用方必须放弃本次清理； 否则可能删掉另一个源仍在生成的文件。
 *
 * @param targetFolder 目标文件夹
 * @param ownManifestName 当前管线的清单文件名
 * @returns 其它清单记录的文件集合，以及是否存在无法读取的其它清单
 */
const getProtectedOutputPaths = (
  targetFolder: string,
  ownManifestName: string,
): { files: Set<string>; hasUnreadableManifest: boolean } => {
  const files = new Set<string>();
  let hasUnreadableManifest = false;
  let entries;

  try {
    entries = readdirSync(targetFolder, { withFileTypes: true });
  } catch {
    return { files, hasUnreadableManifest };
  }

  for (const entry of entries) {
    if (entry.name === ownManifestName || !entry.isFile() || !isGenerationManifest(entry.name))
      continue;

    const protectedFiles = readGenerationManifest(resolve(targetFolder, entry.name));

    if (protectedFiles) for (const filePath of protectedFiles) files.add(filePath);
    else hasUnreadableManifest = true;
  }

  return { files, hasUnreadableManifest };
};

/**
 * 删除单个陈旧输出
 *
 * 只删除目标文件夹内的普通文件：符号链接、目录一律跳过；删除前再用 `realpath` 确认解析后的真实路径仍在目标文件夹内，防止通过符号链接删到目标文件夹之外。
 *
 * @param targetFolder 目标文件夹（绝对路径）
 * @param targetRealFolder 目标文件夹的真实路径
 * @param filePath 清单中的相对路径
 */
const removeStaleOutputFile = (
  targetFolder: string,
  targetRealFolder: string,
  filePath: string,
): void => {
  const normalizedPath = normalizeGenerationPath(filePath);

  if (!normalizedPath || isGenerationManifest(normalizedPath)) return;

  const filename = resolve(targetFolder, normalizedPath);

  if (!isInsideFolder(targetFolder, filename)) return;

  let fileStat;

  try {
    fileStat = lstatSync(filename);
  } catch {
    // 文件已经不存在，无需处理
    return;
  }

  // 不跟随符号链接，也不删除目录
  if (!fileStat.isFile()) return;

  let realFilename: string;

  try {
    realFilename = realpathSync(filename);
  } catch {
    return;
  }

  if (!isInsideFolder(targetRealFolder, realFilename)) {
    console.warn(`已跳过目标文件夹之外的陈旧输出: ${filename}`);
    return;
  }

  rmSync(filename, { force: true });
  console.warn(`已移除陈旧的输出文件: ${filename}`);
};

/**
 * 收集本次生成且确实位于目标文件夹内的普通文件
 *
 * 清单只记录真实存在的普通文件；符号链接、目录以及解析后越出目标文件夹的路径都不会进入清单。
 *
 * @param targetRoot 目标文件夹（绝对路径）
 * @param targetRealRoot 目标文件夹的真实路径
 * @param extension 目标文件扩展名
 * @param generatedFiles 本次实际生成的目标文件相对路径
 * @returns 可写入清单的相对路径集合
 */
const collectGeneratedOutputs = (
  targetRoot: string,
  targetRealRoot: string,
  extension: ".json" | ".md",
  generatedFiles: Iterable<string>,
): Set<string> => {
  const currentFiles = new Set<string>();

  for (const filePath of generatedFiles) {
    const normalizedPath = normalizeGenerationPath(filePath);

    if (!normalizedPath || isGenerationManifest(normalizedPath)) continue;
    if (!normalizedPath.endsWith(extension)) continue;

    const filename = resolve(targetRoot, normalizedPath);

    if (!isInsideFolder(targetRoot, filename)) continue;

    let fileStat;

    try {
      fileStat = lstatSync(filename);
    } catch {
      continue;
    }

    // 清单只记录目标文件夹内真实存在的普通文件
    if (!fileStat.isFile()) continue;

    try {
      if (!isInsideFolder(targetRealRoot, realpathSync(filename))) continue;
    } catch {
      continue;
    }

    currentFiles.add(normalizedPath);
  }

  return currentFiles;
};

/**
 * 将本次生成的文件同步到清单，并删除上次生成、本次不再生成的文件
 *
 * @param sourceFolder 源文件夹
 * @param targetFolder 目标文件夹
 * @param extension 目标文件扩展名
 * @param generatedFiles 本次实际生成的目标文件相对路径
 */
const syncGeneratedOutputs = (
  sourceFolder: string,
  targetFolder: string,
  extension: ".json" | ".md",
  generatedFiles: Iterable<string>,
): void => {
  if (getCanonicalPath(sourceFolder) === getCanonicalPath(targetFolder)) return;
  if (!existsSync(targetFolder)) return;

  const targetRoot = resolve(targetFolder);
  const manifestName = getGenerationManifestName(sourceFolder, extension);
  const manifestFilename = resolve(targetRoot, manifestName);
  const hasManifest = existsSync(manifestFilename);
  const previousFiles = hasManifest ? readGenerationManifest(manifestFilename) : void 0;
  const targetRealRoot = realpathSync(targetRoot);
  const currentFiles = collectGeneratedOutputs(
    targetRoot,
    targetRealRoot,
    extension,
    generatedFiles,
  );
  const sortedFiles = [...currentFiles].sort();

  if (!hasManifest && hasOutputFiles(targetRoot, extension, targetRoot, currentFiles))
    console.warn(`目标文件夹中缺少生成清单，本次不会清理陈旧输出: ${targetRoot}`);

  if (previousFiles) {
    const { files: protectedFiles, hasUnreadableManifest } = getProtectedOutputPaths(
      targetRoot,
      manifestName,
    );

    if (hasUnreadableManifest) {
      console.warn(`目标文件夹中存在无法读取的生成清单，本次不会清理陈旧输出: ${targetRoot}`);
    } else {
      for (const filePath of previousFiles) {
        if (currentFiles.has(filePath) || protectedFiles.has(filePath)) continue;

        removeStaleOutputFile(targetRoot, targetRealRoot, filePath);
      }
    }
  }

  writeGenerationManifest(manifestFilename, sortedFiles);
};

/**
 * 清理目标文件夹中源文件已不存在的旧输出
 *
 * 清理只依据生成清单：只删除「清单中记录过、本次未生成」的文件，清单之外的文件（手写文档、其它工具产物、其它源的输出）永远不会被删除。目标文件夹中还没有清单时按首次运行保守处理：不删除任何文件，只写入本次生成的文件清单。
 *
 * 仅在源与目标文件夹不同时执行（按真实路径比较，符号链接别名视为同一目录）；清单文件带源文件夹真实路径与扩展名的哈希，多个源共用同一目标文件夹时互不影响。只要目标文件夹中存在无法读取的其它清单，本次就完全跳过清理，避免误删其它源仍在生成的文件。清理不会跟随符号链接目录，删除前还会用
 * `realpath` 确认文件仍位于目标文件夹内。
 *
 * 只把 `.yml` 当作源文件（转换函数也只读取 `.yml`），`源名.yaml` 不会进入生成集。
 *
 * @param sourceFolder 源文件夹
 * @param targetFolder 目标文件夹
 * @param extension 目标文件扩展名
 */
export const removeStaleOutputs = (
  sourceFolder: string,
  targetFolder: string,
  extension: ".json" | ".md",
): void => {
  if (getCanonicalPath(sourceFolder) === getCanonicalPath(targetFolder)) return;
  if (!existsSync(targetFolder)) return;

  if (!existsSync(sourceFolder)) {
    console.warn(`源文件夹不存在，已跳过陈旧输出清理: ${resolve(sourceFolder)}`);
    return;
  }

  const generatedFiles = getFileList(sourceFolder, "yml").map((filePath) =>
    getOutputRelativePath(filePath, extension),
  );

  syncGeneratedOutputs(sourceFolder, targetFolder, extension, generatedFiles);
};

/**
 * 将源文件夹下的所有 YAML 文件转换为 JSON 文件
 *
 * 本次实际写出的文件会记入目标文件夹的生成清单，下一次运行据此清理源文件已删除的旧输出。 空 YAML 与转换函数返回 `null`/`undefined`
 * 的文件会被跳过且不写入清单：如果该文件上次生成过输出， 下一次运行会把它按陈旧输出删除（旧实现会永久保留）。
 *
 * @param sourceFolder 源文件夹
 * @param targetFolder 目标文件夹，默认为源文件夹
 * @param convertFunction 转换函数，接收解析后的数据与文件路径，返回转换后的值；返回 `null`/`undefined` 时跳过该文件
 * @param processFunction 内容处理函数，在解析前对 YAML 内容进行预处理
 */
export const convertYamlFilesToJson = <T = unknown, Value = T>(
  sourceFolder: string,
  targetFolder = sourceFolder,
  convertFunction: (data: T, filePath: string) => Value = (data): Value => data as unknown as Value,
  processFunction?: (content: string, filePath: string) => string,
): void => {
  const fileList = getFileList(sourceFolder, "yml");
  const errors: Error[] = [];
  const generatedFiles = new Set<string>();

  fileList.forEach((filePath) => {
    const sourceFilename = resolve(sourceFolder, filePath);
    const targetFilename = resolve(targetFolder, getOutputRelativePath(filePath, ".json"));
    const targetFolderPath = dirname(targetFilename);
    const yamlRelativePath = relative("./", filePath.replace(/\.yml$/u, ""));

    try {
      const content = readFileSync(sourceFilename, { encoding: "utf-8" });
      const finalContent = processFunction?.(content, yamlRelativePath) ?? content;
      const parsed = parseYaml<T>(finalContent, sourceFilename);

      if (parsed === void 0) {
        console.warn(`空 YAML 文件已跳过: ${sourceFilename}`);
        return;
      }

      const result = convertFunction(parsed, yamlRelativePath);

      // `null`/`undefined` 表示调用方要求跳过该文件；`""`、`0`、`false` 是有效输出，需要正常写出
      if (result != null) {
        if (!existsSync(targetFolderPath)) mkdirSync(targetFolderPath, { recursive: true });

        writeFileAtomically(targetFilename, JSON.stringify(result));
        generatedFiles.add(relative(resolve(targetFolder), targetFilename));
      }
    } catch (err) {
      errors.push(
        new Error(`YAML 转 JSON 失败: ${sourceFilename}`, {
          cause: err,
        }),
      );
    }
  });

  if (errors.length > 0)
    throw new AggregateError(errors, `YAML 转 JSON 失败（${errors.length} 个文件）`);

  syncGeneratedOutputs(sourceFolder, targetFolder, ".json", generatedFiles);
};

/**
 * 将源文件夹下的所有 YAML 文件转换为 Markdown 文件
 *
 * 与 `convertYamlFilesToJson` 不同，本函数不把转换函数返回的 `null`/`undefined` 视为“跳过”： 转换函数被声明为返回
 * `string`，当前消费者都返回 Markdown 文本；若运行时返回 `null`/`undefined`， 写入会失败并计入聚合错误，而不是静默跳过该文件。
 *
 * 空 YAML 文件仍会被跳过且不写入生成清单；如果该文件上次生成过 Markdown，下一次运行会把它按陈旧输出删除。
 *
 * @param sourceFolder 源文件夹
 * @param convertFunction 转换函数，接收解析后的数据与文件路径，返回 Markdown 内容
 * @param targetFolder 目标文件夹，默认为源文件夹
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const convertYamlFilesToMarkdown = <T = unknown>(
  sourceFolder: string,
  convertFunction: (data: T, filePath: string) => string,
  targetFolder = sourceFolder,
): void => {
  const fileList = getFileList(sourceFolder, "yml");
  const errors: Error[] = [];
  const generatedFiles = new Set<string>();

  fileList.forEach((filePath) => {
    const sourceFilename = resolve(sourceFolder, filePath);
    const targetFilename = resolve(targetFolder, getOutputRelativePath(filePath, ".md"));
    const targetFolderPath = dirname(targetFilename);

    try {
      const content = readFileSync(sourceFilename, { encoding: "utf-8" });
      const parsed = parseYaml<T>(content, sourceFilename);

      if (parsed === void 0) {
        console.warn(`空 YAML 文件已跳过: ${sourceFilename}`);
        return;
      }

      const result = convertFunction(parsed, relative("./", filePath.replace(/\.yml$/u, "")));

      if (!existsSync(targetFolderPath)) mkdirSync(targetFolderPath, { recursive: true });

      writeFileAtomically(targetFilename, result);
      generatedFiles.add(relative(resolve(targetFolder), targetFilename));
    } catch (err) {
      errors.push(
        new Error(`YAML 转 Markdown 失败: ${sourceFilename}`, {
          cause: err,
        }),
      );
    }
  });

  if (errors.length > 0)
    throw new AggregateError(errors, `YAML 转 Markdown 失败（${errors.length} 个文件）`);

  syncGeneratedOutputs(sourceFolder, targetFolder, ".md", generatedFiles);
};

export interface YamlInfo<Value = unknown> {
  type: "file";
  filename: string;
  value: Value;
}

export interface YamlDirInfo<Value = unknown> {
  type: "dir";
  dirname: string;
  content: YamlMapItem<Value>[];
}

export type YamlMapItem<Value> = YamlInfo<Value> | YamlDirInfo<Value>;

/**
 * 获取源文件夹下的 YAML 文件映射
 *
 * 与其它 YAML 辅助函数一致，空文档（空文件、纯注释、仅文档标记/指令）会被跳过并打印中文告警，而不是抛错中断整个映射；空目录仍会保留。
 *
 * @param sourceFolder 源文件夹
 * @param convertFunction 转换函数，接收解析后的数据与文件路径，返回转换后的值
 * @returns YAML 映射列表
 */
export const getYamlMap = <T = unknown, Value = T>(
  sourceFolder: string,
  convertFunction: (data: T, filePath: string) => Value = (data): Value => data as unknown as Value,
): YamlMapItem<Value>[] => {
  const fileMap = getFileMap(sourceFolder, "yml");

  const convertYaml = (base: string, item: FileMapItem): YamlMapItem<Value> | undefined => {
    if (item.type === "file") {
      const filename = join(base, item.filename);
      const content = readFileSync(filename, { encoding: "utf-8" });
      const parsed = parseYaml<T>(content, filename);

      if (parsed === void 0) {
        console.warn(`空 YAML 文件已跳过: ${filename}`);
        return void 0;
      }

      return {
        type: "file",
        filename: item.filename,
        value: convertFunction(parsed, filename.replace(/\.yml$/u, "")),
      };
    }

    const itemDirname = join(base, item.dirname);

    return {
      type: "dir",
      dirname: item.dirname,
      content: item.content
        .map((block) => convertYaml(itemDirname, block))
        .filter((child): child is YamlMapItem<Value> => child !== void 0),
    };
  };

  return fileMap
    .map((item) => convertYaml(sourceFolder, item))
    .filter((item): item is YamlMapItem<Value> => item !== void 0);
};
