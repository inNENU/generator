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
    throw new Error("OSS_KEY_ID or OSS_KEY_SECRET is not set");

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

      console.debug(`Putting file ${localPath}`);
      const result = await client.put(onlinePath, localPath, { headers });

      if (result.res.status !== 200)
        console.error(`upload ${localPath} failed:`, result.res.status);
    }
  } catch (err) {
    console.error("Upload files to OSS failed:", err);
  }
};

export const removeOSSFiles = async (filePaths: string[]): Promise<void> => {
  try {
    if (filePaths.length === 0) return;

    initOSS();

    console.debug(`Deleting file ${filePaths.join(", ")}`);

    const result = await client.deleteMulti(filePaths);

    if (result.res.status !== 200)
      console.error(`delete failed:`, result.res.status);
  } catch (err) {
    console.error(`delete failed:`, err);
  }
};
