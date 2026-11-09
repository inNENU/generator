import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * 当前文件系统是否区分大小写。
 *
 * 只有区分大小写的文件系统才能同时创建仅大小写不同的文件名（如 `add.svg` 与 `Add.svg`）， 相关用例需要据此跳过，避免在大小写不敏感的文件系统上写进同一个文件。
 */
export const isCaseSensitiveFs = ((): boolean => {
  const folder = mkdtempSync(path.join(tmpdir(), "innenu-case-sensitive-"));

  try {
    writeFileSync(path.join(folder, "probe"), "");
    return !existsSync(path.join(folder, "PROBE"));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
})();
