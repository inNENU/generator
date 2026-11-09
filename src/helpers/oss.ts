// oxlint-disable node/no-process-env
import OSS from "ali-oss";

import { createPromiseQueue } from "./promiseQueue.js";

let client: OSS | null = null;

const headers = {
  "x-oss-storage-class": "Standard",
  "x-oss-object-acl": "private",
};

/** `client.deleteMulti` 单次请求的对象数量上限 */
const DELETE_BATCH_SIZE = 1000;

/** 上传文件时允许同时进行的最大请求数 */
const UPLOAD_CONCURRENCY = 5;

/** OSS 对象 key 非法时的错误前缀 */
const INVALID_KEY_MESSAGE = "OSS 对象 key 非法";

/**
 * 初始化 OSS 客户端
 *
 * @internal
 */
export const initOSS = (): void => {
  if (client) return;

  const accessKeyId = process.env.OSS_KEY_ID;
  const accessKeySecret = process.env.OSS_KEY_SECRET;
  const region = process.env.OSS_REGION;
  const bucket = process.env.OSS_BUCKET;

  if (!accessKeyId || !accessKeySecret || !region || !bucket) {
    const missing = [
      accessKeyId ? "" : "OSS_KEY_ID",
      accessKeySecret ? "" : "OSS_KEY_SECRET",
      region ? "" : "OSS_REGION",
      bucket ? "" : "OSS_BUCKET",
    ].filter((name) => name !== "");

    throw new Error(`OSS 初始化失败：缺少环境变量 ${missing.join("、")}`);
  }

  client = new OSS({
    accessKeyId,
    accessKeySecret,
    region,
    bucket,
    secure: true,
  });
};

/**
 * 重置 OSS 客户端，便于测试或环境变量变化后重建
 *
 * @internal
 */
export const resetOSSClient = (): void => {
  client = null;
};

/**
 * 获取（必要时初始化）OSS 客户端
 *
 * @returns 已初始化的 OSS 客户端
 */
const getClient = (): OSS => {
  initOSS();

  if (!client) throw new Error("OSS 初始化失败：客户端未创建");

  return client;
};

/**
 * 校验并规范化 OSS 对象 key
 *
 * 去掉前导的 `./` 与前导的 `/`，并拒绝空 key、`.` / `..` 路径段、 空路径段、控制字符、反斜杠以及本地绝对路径、URL 等可疑输入。 返回的 key 始终是相对于
 * bucket 根目录的路径，可直接用于上传与删除。
 *
 * @param key 待规范化的对象 key
 * @returns 规范化后的对象 key
 * @throws {TypeError} 当 key 不是字符串时抛出
 * @throws {Error} 当 key 为空或包含非法路径段时抛出中文错误
 * @internal
 */
export const normalizeObjectKey = (key: string): string => {
  if (typeof key !== "string") throw new TypeError(`${INVALID_KEY_MESSAGE}：key 必须是字符串`);

  if (key.trim() === "")
    throw new Error(`${INVALID_KEY_MESSAGE}：key 不能为空（收到 ${JSON.stringify(key)}）`);

  if (/[\p{Cc}]/u.test(key))
    throw new Error(`${INVALID_KEY_MESSAGE}：key 不能包含控制字符（收到 ${JSON.stringify(key)}）`);

  if (key.includes("\\")) {
    throw new Error(
      `${INVALID_KEY_MESSAGE}：key 不能包含反斜杠，请使用 "/" 分隔路径（收到 ${JSON.stringify(key)}）`,
    );
  }

  if (/^[a-zA-Z]:/u.test(key) || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//u.test(key)) {
    throw new Error(
      `${INVALID_KEY_MESSAGE}：key 不能是本地绝对路径或 URL（收到 ${JSON.stringify(key)}）`,
    );
  }

  if (key === "~" || key.startsWith("~/"))
    throw new Error(`${INVALID_KEY_MESSAGE}：key 不能是家目录路径（收到 ${JSON.stringify(key)}）`);

  let normalized = key;

  // 去掉全部前导 "./" 与 "/"，避免把本地路径直接当作 OSS key
  while (normalized.startsWith("./") || normalized.startsWith("/"))
    normalized = normalized.startsWith("./") ? normalized.slice(2) : normalized.slice(1);

  if (normalized === "")
    throw new Error(`${INVALID_KEY_MESSAGE}：key 不能为空（收到 ${JSON.stringify(key)}）`);

  for (const segment of normalized.split("/")) {
    if (segment === "") {
      throw new Error(
        `${INVALID_KEY_MESSAGE}：key 不能包含空路径段（连续或结尾的 "/"）（收到 ${JSON.stringify(key)}）`,
      );
    }

    if (segment === "." || segment === "..") {
      throw new Error(
        `${INVALID_KEY_MESSAGE}：key 不能包含 "." 或 ".." 路径段（收到 ${JSON.stringify(key)}）`,
      );
    }
  }

  return normalized;
};

/**
 * 规范化删除前缀
 *
 * 前缀始终以 `/` 结尾，避免 `assets` 误匹配 `assets-old` 这类同前缀目录。 不以 `/` 结尾的前缀会被视为目录前缀。
 *
 * @param prefix 删除前缀
 * @returns 以 `/` 结尾的规范化前缀
 * @throws {TypeError} 当前缀不是字符串时抛出
 * @throws {Error} 当前缀为空或包含非法路径段时抛出中文错误
 */
const normalizeDeletePrefix = (prefix: string): string => {
  if (typeof prefix !== "string") throw new TypeError("OSS 删除前缀非法：前缀必须是字符串");

  try {
    return `${normalizeObjectKey(prefix.endsWith("/") ? prefix.slice(0, -1) : prefix)}/`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    throw new Error(`OSS 删除前缀非法（收到 ${JSON.stringify(prefix)}）：${message}`, {
      cause: err,
    });
  }
};

/**
 * `removeOSSFiles` 的选项
 *
 * @internal
 */
export interface RemoveOSSFilesOptions {
  /** 允许删除的 key 前缀，提供后所有 key 都必须位于该前缀之下 */
  prefix?: string;
}

/**
 * 上传文件到 OSS
 *
 * 上传前先校验所有线上 key，存在非法 key 时不会上传任何文件。 上传使用有界并发（默认 5），单文件独立捕获错误，任一失败不影响其余文件继续上传；
 * 全部处理完后若存在失败则抛出聚合错误，避免"缺文件/失败"被整体吞掉导致 静默漏传（含本应一并上传的后续文件）。
 *
 * @param filePaths 文件路径列表，元素可以是本地路径，也可以是包含本地路径与线上路径的对象
 * @throws {Error} 当线上 key 非法时抛出中文错误
 * @throws {AggregateError} 当存在上传失败时抛出，包含所有失败 key 与原始错误
 * @internal
 */
export const uploadOSSFiles = async (
  filePaths: (string | { local: string; online: string })[],
): Promise<void> => {
  const tasks = filePaths.map((filePath) => {
    const [localPath, onlinePath] =
      typeof filePath === "string" ? [filePath, filePath] : [filePath.local, filePath.online];

    return { localPath, onlinePath: normalizeObjectKey(onlinePath) };
  });

  const oss = getClient();

  /** 上传失败的文件，保持与错误一一对应 */
  const failures: { key: string; error: Error }[] = [];

  await createPromiseQueue(
    tasks.map(({ localPath, onlinePath }) => async (): Promise<void> => {
      console.debug(`上传文件 ${localPath}`);

      try {
        const result = await oss.put(onlinePath, localPath, { headers });

        if (result.res.status !== 200) {
          const error = new Error(`上传 ${onlinePath} 失败：HTTP ${result.res.status}`);

          console.error(error.message);
          failures.push({ key: onlinePath, error });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        console.error(`上传 ${onlinePath} 失败:`, err);
        failures.push({ key: onlinePath, error });
      }
    }),
    UPLOAD_CONCURRENCY,
  );

  if (failures.length > 0) {
    failures.sort((a, b) => a.key.localeCompare(b.key));

    throw new AggregateError(
      failures.map(({ error }) => error),
      `部分文件上传 OSS 失败（${failures.length} 个）: ${failures.map(({ key }) => key).join(", ")}`,
    );
  }
};

/**
 * 删除 OSS 文件
 *
 * 删除前先校验所有 key（以及可选的前缀约束），任一 key 非法或不在允许前缀下 都会在删除任何对象之前抛错。 `deleteMulti` 单次最多支持约 1000 个对象，因此分批删除；
 * 任一失败不影响其余批次，全部处理完后若存在失败则抛出聚合错误，避免整批 被吞掉导致 OSS 残留已删除的陈旧文件。
 *
 * @param filePaths 文件路径列表
 * @param options 删除选项，可通过 `prefix` 限定只删除某个前缀下的对象
 * @throws {Error} 当 key 非法或存在不以允许前缀开头的 key 时抛出中文错误，且不会删除任何对象
 * @throws {AggregateError} 当存在删除失败时抛出，包含所有失败 key 与原始错误
 * @internal
 */
export const removeOSSFiles = async (
  filePaths: string[],
  options: RemoveOSSFilesOptions = {},
): Promise<void> => {
  const { prefix } = options;
  const allowedPrefix = typeof prefix === "string" ? normalizeDeletePrefix(prefix) : null;

  const keys = filePaths.map((filePath) => normalizeObjectKey(filePath));

  if (allowedPrefix) {
    const violations = keys.filter((key) => !key.startsWith(allowedPrefix));

    if (violations.length > 0) {
      throw new Error(
        `OSS 删除前缀校验失败：以下 ${violations.length} 个 key 不以 "${allowedPrefix}" 开头，未删除任何对象: ${violations.join(", ")}`,
      );
    }
  }

  if (keys.length === 0) return;

  const oss = getClient();

  console.debug(`删除 OSS 文件 ${keys.length} 个`);

  const failedKeys: string[] = [];
  const errors: Error[] = [];

  for (let index = 0; index < keys.length; index += DELETE_BATCH_SIZE) {
    const batch = keys.slice(index, index + DELETE_BATCH_SIZE);

    try {
      // oxlint-disable-next-line no-await-in-loop -- 分批删除，控制单次请求的对象数量
      const result = await oss.deleteMulti(batch);

      if (result.res.status !== 200) {
        const error = new Error(`删除 OSS 对象失败：HTTP ${result.res.status}`);

        console.error(error.message);
        failedKeys.push(...batch);
        errors.push(error);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      console.error("删除批量失败:", err);
      failedKeys.push(...batch);
      errors.push(error);
    }
  }

  if (failedKeys.length > 0) {
    throw new AggregateError(
      errors,
      `部分文件删除 OSS 失败（${failedKeys.length} 个）: ${failedKeys.join(", ")}`,
    );
  }
};
