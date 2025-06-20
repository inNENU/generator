import OSS from "ali-oss";

let client: OSS;

const headers = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "x-oss-storage-class": "Standard",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "x-oss-object-acl": "private",
};

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

export const uploadOSSFiles = async (
  filePaths: (string | { local: string; online: string })[],
): Promise<void> => {
  try {
    initOSS();

    for (const filePath of filePaths) {
      const [localPath, onlinePath] =
        typeof filePath === "string"
          ? [filePath, filePath]
          : [filePath.local, filePath.online];

      console.debug(`上传文件 ${localPath}`);
      const result = await client.put(onlinePath, localPath, { headers });

      if (result.res.status !== 200)
        console.error(`上传 ${localPath} 失败:`, result.res.status);
    }
  } catch (err) {
    console.error("上传文件到 OSS 失败:", err);
  }
};

export const removeOSSFiles = async (filePaths: string[]): Promise<void> => {
  try {
    if (filePaths.length === 0) return;

    initOSS();

    console.debug(`删除 OSS 文件 ${filePaths.join(", ")}`);

    const result = await client.deleteMulti(filePaths);

    if (result.res.status !== 200)
      console.error(`删除失败:`, result.res.status);
  } catch (err) {
    console.error(`删除失败:`, err);
  }
};
