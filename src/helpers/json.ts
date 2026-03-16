import { readFile, readdir } from "node:fs/promises";

const testJSON = async (path: string): Promise<void> => {
  let content: string;

  try {
    content = await readFile(path, { encoding: "utf-8" });
  } catch (err) {
    console.error(`读取文件 ${path} 失败:`, err);
    throw err;
  }

  try {
    JSON.parse(content);
  } catch {
    const error = new Error(`${path} 不是一个正确的 JSON 文件`);

    console.error(error.message);
    throw error;
  }
};

export const checkJSON = async (path: string): Promise<void> => {
  try {
    const files = await readdir(path, { withFileTypes: true });

    const checkProcess: Promise<void>[] = [];

    files.forEach((file) => {
      // 是文件
      if (file.isDirectory()) checkProcess.push(checkJSON(`${path}/${file.name}`));
      else if (file.name.split(".").pop() === "json")
        checkProcess.push(testJSON(`${path}/${file.name}`));
    });

    await Promise.all(checkProcess);
  } catch (err) {
    console.error(`读取目录 ${path} 失败:`, err);
    throw err;
  }
};
