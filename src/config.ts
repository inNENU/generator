interface Config {
  assets: string;
  icon: string;
  mapFolder: string;
  mapKey: string;
  pageFolder: string;
}

const DEFAULT_CONFIG: Config = {
  assets: "",
  icon: "",
  mapKey: "",
  mapFolder: "",
  pageFolder: "page",
};

export const generatorConfig: Config = { ...DEFAULT_CONFIG };

/**
 * 恢复生成器默认配置
 *
 * 主要供测试在修改配置后清理状态使用；也会清除 `assets` / `icon` 结尾的斜杠。
 */
export const resetConfig = (): void => {
  Object.assign(generatorConfig, DEFAULT_CONFIG);
};

/**
 * 配置生成器
 *
 * 只需传入要覆盖的字段，未传入的字段保持当前值（初始为默认值）。`assets` / `icon` 结尾的斜杠会被移除。
 *
 * @param nextConfig 配置项，支持部分覆盖
 */
export const config = (nextConfig: Partial<Config> = {}): void => {
  const next: Config = { ...generatorConfig, ...nextConfig };

  Object.assign(generatorConfig, {
    ...next,
    assets: next.assets.replace(/\/$/u, ""),
    icon: next.icon.replace(/\/$/u, ""),
  });
};
