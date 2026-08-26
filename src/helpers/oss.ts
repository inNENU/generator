// oxlint-disable node/no-process-env
import OSS from "ali-oss";

let client: OSS;

const headers = {
  "x-oss-storage-class": "Standard",
  "x-oss-object-acl": "private",
};

/** `client.deleteMulti` 单次请求的对象数量上限 */
const DELETE_BATCH_SIZE = 1000;

/** 初始化 OSS 客户端 */
export const initOSS = (): void => {
  if (!process.env.OSS_KEY_ID || !process.env.OSS_KEY_SECRET)
    throw new Error("OSS_KEY_ID 或 OSS_KEY_SECRET 未设置");

  client ??= new OSS({
    accessKeyId: process.env.OSS_KEY_ID,
    accessKeySecret: process.env.OSS_KEY_SECRET,
    region: process.env.OSS_REGION,
    bucket: process.env.OSS_BUCKET,
    secure: true,
  });
};

/**
 * 上传文件到 OSS
 *
 * 单文件独立捕获错误，任一失败不影响其余文件继续上传； 全部处理完后若存在失败则抛出聚合错误，避免"缺文件/失败"被整体吞掉导致 静默漏传（含本应一并上传的后续文件）。
 *
 * @param filePaths 文件路径列表，元素可以是本地路径，也可以是包含本地路径与线上路径的对象
 */
export const uploadOSSFiles = async (
  filePaths: (string | { local: string; online: string })[],
): Promise<void> => {
  initOSS();

  const failed: string[] = [];

  for (const filePath of filePaths) {
    const [localPath, onlinePath] =
      typeof filePath === "string" ? [filePath, filePath] : [filePath.local, filePath.online];

    console.debug(`上传文件 ${localPath}`);

    try {
      // oxlint-disable-next-line no-await-in-loop
      const result = await client.put(onlinePath, localPath, { headers });

      if (result.res.status !== 200) {
        console.error(`上传 ${localPath} 失败: HTTP ${result.res.status}`);
        failed.push(localPath);
      }
    } catch (err) {
      console.error(`上传 ${localPath} 失败:`, err);
      failed.push(localPath);
    }
  }

  if (failed.length > 0)
    throw new Error(`部分文件上传 OSS 失败（${failed.length} 个）: ${failed.join(", ")}`);
};

/**
 * 删除 OSS 文件
 *
 * `deleteMulti` 单次最多支持约 1000 个对象，因此分批删除； 任一失败不影响其余批次，全部处理完后若存在失败则抛出聚合错误，避免整批 被吞掉导致 OSS 残留已删除的陈旧文件。
 *
 * @param filePaths 文件路径列表
 */
export const removeOSSFiles = async (filePaths: string[]): Promise<void> => {
  if (filePaths.length === 0) return;

  initOSS();

  console.debug(`删除 OSS 文件 ${filePaths.length} 个`);

  const failed: string[] = [];

  for (let index = 0; index < filePaths.length; index += DELETE_BATCH_SIZE) {
    const batch = filePaths.slice(index, index + DELETE_BATCH_SIZE);

    try {
      // oxlint-disable-next-line no-await-in-loop
      const result = await client.deleteMulti(batch);

      if (result.res.status !== 200) {
        console.error(`删除失败: HTTP ${result.res.status}`);
        failed.push(...batch);
      }
    } catch (err) {
      console.error(`删除批量失败:`, err);
      failed.push(...batch);
    }
  }

  if (failed.length > 0) throw new Error(`部分文件删除 OSS 失败（${failed.length} 个）`);
};
