import { execSync } from "node:child_process";

export const getCurrentBranch = (): string =>
  execSync("git branch --show-current").toString().trim();

export interface ChangedFilesInfo {
  added: string[];
  modified: string[];
  deleted: string[];
}

export const getLastChangedFiles = (): ChangedFilesInfo => {
  // Execute the git diff-tree command
  const result = execSync(`git diff-tree --no-commit-id --name-status -r HEAD`)
    .toString()
    .trim();

  const lines = result.split("\n");

  // Initialize arrays for each type of file change
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  // Process the result line by line
  lines.forEach((line) => {
    const [status, filePath] = line.split("\t");

    switch (status) {
      case "A":
        added.push(filePath);
        break;
      case "M":
        modified.push(filePath);
        break;
      case "D":
        deleted.push(filePath);
        break;
    }
  });

  return {
    added: added,
    modified: modified,
    deleted: deleted,
  };
};
