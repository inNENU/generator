/**
 * 生成清单读写与陈旧输出清理
 *
 * 独立成文件，避免 YAML 解析与转换所在的 `yaml.ts` 超出 lint 的行数上限；这里不负责 YAML 解析。
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import { isAbsolute, normalize, relative, resolve } from "upath";

import { getFileList } from "./getFileList.js";
import { stripYamlExtension, YAML_EXTENSIONS } from "./yamlPath.js";

/**
 * 原子写入文件：先写临时文件再 rename，避免中途失败留下半截内容
 *
 * @param filename 目标文件路径
 * @param content 文件内容
 */
export const writeFileAtomically = (filename: string, content: string): void => {
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
 * 获取某个（源文件夹、产物类型）组合的生成清单文件名
 *
 * 文件名带源文件夹真实路径与产物类型的哈希，保证多个源共用同一目标文件夹时各用各的清单，不会互相覆盖或按对方的清单清理。 同一个物理源经符号链接或 `/var` 别名访问时仍指向同一个清单。
 *
 * @param sourceFolder 源文件夹
 * @param manifestKey 产物类型标识（如 `.json`、`.md`、`.svg`），同时参与清单名哈希
 * @returns 目标文件夹根目录下的清单文件名
 */
const getGenerationManifestName = (sourceFolder: string, manifestKey: string): string => {
  const sourceHash = createHash("sha256")
    .update(`${getCanonicalPath(sourceFolder)}\0${manifestKey}`)
    .digest("hex")
    .slice(0, 16);

  return `${GENERATION_MANIFEST_PREFIX}${manifestKey.replace(/^\./u, "")}.${sourceHash}.json`;
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
export const getOutputRelativePath = (filePath: string, extension: ".json" | ".md"): string => {
  const basePath = stripYamlExtension(filePath);

  return extension === ".md"
    ? `${basePath}.md`.replace(/(?<sep>\/|^)index\.md$/u, "$<sep>README.md")
    : `${basePath}.json`;
};

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
 * 使用 `Dirent`（不跟随符号链接）遍历，只统计普通文件，并跳过本次已经生成的文件。
 *
 * @param folder 当前遍历的文件夹
 * @param extension 目标文件扩展名；为 `null` 时统计所有普通文件（如无扩展名的 SVG 图标产物）
 * @param rootFolder 目标文件夹根目录
 * @param excludedFiles 本次已经生成、无需告警的相对路径
 * @returns 是否存在本次未生成的输出文件
 */
const hasOutputFiles = (
  folder: string,
  extension: string | null,
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

    if (!entry.isFile() || isGenerationManifest(entry.name)) return false;
    if (extension != null && !entry.name.endsWith(extension)) return false;

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
 * @param extension 目标文件扩展名；为 `null` 时不按扩展名过滤（如无扩展名的 SVG 图标产物）
 * @param generatedFiles 本次实际生成的目标文件相对路径
 * @returns 可写入清单的相对路径集合
 */
const collectGeneratedOutputs = (
  targetRoot: string,
  targetRealRoot: string,
  extension: string | null,
  generatedFiles: Iterable<string>,
): Set<string> => {
  const currentFiles = new Set<string>();

  for (const filePath of generatedFiles) {
    const normalizedPath = normalizeGenerationPath(filePath);

    if (!normalizedPath || isGenerationManifest(normalizedPath)) continue;
    if (extension != null && !normalizedPath.endsWith(extension)) continue;

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

interface SyncOutputOptions {
  /** 产物类型标识，用于区分同一目标文件夹中的不同产物 */
  manifestKey: string;
  /** 目标文件扩展名；为 `null` 时不按扩展名过滤 */
  extension: string | null;
}

/**
 * 同步生成清单并清理陈旧输出（通用实现）
 *
 * @param sourceFolder 源文件夹
 * @param targetFolder 目标文件夹
 * @param options 产物类型与扩展名
 * @param generatedFiles 本次实际生成的目标文件相对路径
 */
const syncOutputs = (
  sourceFolder: string,
  targetFolder: string,
  { extension, manifestKey }: SyncOutputOptions,
  generatedFiles: Iterable<string>,
): void => {
  if (getCanonicalPath(sourceFolder) === getCanonicalPath(targetFolder)) return;
  if (!existsSync(targetFolder)) return;

  const targetRoot = resolve(targetFolder);
  const manifestName = getGenerationManifestName(sourceFolder, manifestKey);
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
 * 将本次生成的文件同步到清单，并删除上次生成、本次不再生成的文件
 *
 * @param sourceFolder 源文件夹
 * @param targetFolder 目标文件夹
 * @param extension 目标文件扩展名
 * @param generatedFiles 本次实际生成的目标文件相对路径
 */
export const syncGeneratedOutputs = (
  sourceFolder: string,
  targetFolder: string,
  extension: ".json" | ".md",
  generatedFiles: Iterable<string>,
): void => {
  syncOutputs(sourceFolder, targetFolder, { manifestKey: extension, extension }, generatedFiles);
};

/**
 * 同步无扩展名产物（SVG 图标）的生成清单，并删除上次生成、本次不再生成的产物
 *
 * 图标产物写入目标文件夹根目录且没有扩展名（根图标写文件、分类聚合为同名 JSON），无法复用按 `.json` / `.md` 过滤的
 * `syncGeneratedOutputs`；清单只记录输出文件名，删除规则与 YAML 产物一致：
 * 只删除「清单记录过、本次未生成」的普通文件，清单之外的文件不碰，首次运行与清单损坏时不做清理。
 *
 * @param sourceFolder 源文件夹
 * @param targetFolder 目标文件夹
 * @param generatedFiles 本次实际生成的目标文件名（相对目标文件夹）
 */
export const syncGeneratedIconOutputs = (
  sourceFolder: string,
  targetFolder: string,
  generatedFiles: Iterable<string>,
): void => {
  syncOutputs(sourceFolder, targetFolder, { manifestKey: ".svg", extension: null }, generatedFiles);
};

/**
 * 清理目标文件夹中源文件已不存在的旧输出
 *
 * 清理只依据生成清单：只删除「清单中记录过、本次未生成」的文件，清单之外的文件（手写文档、其它工具产物、其它源的输出）永远不会被删除。目标文件夹中还没有清单时按首次运行保守处理：不删除任何文件，只写入本次生成的文件清单。
 *
 * 仅在源与目标文件夹不同时执行（按真实路径比较，符号链接别名视为同一目录）；清单文件带源文件夹真实路径与扩展名的哈希，多个源共用同一目标文件夹时互不影响。只要目标文件夹中存在无法读取的其它清单，本次就完全跳过清理，避免误删其它源仍在生成的文件。清理不会跟随符号链接目录，删除前还会用
 * `realpath` 确认文件仍位于目标文件夹内。
 *
 * `.yml` 与 `.yaml` 都会被当作源文件，与转换函数的读取范围保持一致。
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

  const generatedFiles = getFileList(sourceFolder, YAML_EXTENSIONS).map((filePath) =>
    getOutputRelativePath(filePath, extension),
  );

  syncGeneratedOutputs(sourceFolder, targetFolder, extension, generatedFiles);
};
