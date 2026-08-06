// oxlint-disable node/no-process-env
import OSS from "ali-oss";

let client: OSS;

const headers = {
  "x-oss-storage-class": "Standard",
  "x-oss-object-acl": "private",
};

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
 * @param filePaths 文件路径列表，元素可以是本地路径，也可以是包含本地路径与线上路径的对象
 */
export const uploadOSSFiles = async (
  filePaths: (string | { local: string; online: string })[],
): Promise<void> => {
  try {
    initOSS();

    for (const filePath of filePaths) {
      const [localPath, onlinePath] =
        typeof filePath === "string" ? [filePath, filePath] : [filePath.local, filePath.online];

      console.debug(`上传文件 ${localPath}`);
      // oxlint-disable-next-line no-await-in-loop
      const result = await client.put(onlinePath, localPath, { headers });

      if (result.res.status !== 200) console.error(`上传 ${localPath} 失败:`, result.res.status);
    }
  } catch (err) {
    console.error("上传文件到 OSS 失败:", err);
  }
};

/**
 * 删除 OSS 文件
 *
 * @param filePaths 文件路径列表
 */
export const removeOSSFiles = async (filePaths: string[]): Promise<void> => {
  try {
    if (filePaths.length === 0) return;

    initOSS();

    console.debug(`删除 OSS 文件 ${filePaths.join(", ")}`);

    const result = await client.deleteMulti(filePaths);

    if (result.res.status !== 200) console.error(`删除失败:`, result.res.status);
  } catch (err) {
    console.error(`删除失败:`, err);
  }
};
