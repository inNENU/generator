/** 生成器配置 */
export interface Config {
  /** 公共资源基础地址，供 `$` 文件别名与图标链接使用 */
  assets: string;
  /** 图标基础目录 */
  icon: string;
  /** 地图页与标记数据所在目录 */
  mapFolder: string;
  /** 腾讯地图 key */
  mapKey: string;
  /** 页面 YAML 文件所在目录 */
  pageFolder: string;
}

const DEFAULT_CONFIG: Config = {
  assets: "",
  icon: "",
  mapKey: "",
  mapFolder: "",
  pageFolder: "page",
};

/**
 * 去除路径或 URL 末尾的一个或多个斜杠
 *
 * @param value 待规范化的路径或 URL
 * @returns 去除末尾斜杠后的值
 */
const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/u, "");

/**
 * 规范化配置中的路径与 URL
 *
 * @param config 待规范化的完整配置
 * @returns 规范化后的配置
 */
const normalizeConfig = (config: Config): Config => ({
  ...config,
  assets: stripTrailingSlashes(config.assets),
  icon: stripTrailingSlashes(config.icon),
  mapFolder: stripTrailingSlashes(config.mapFolder),
  pageFolder: stripTrailingSlashes(config.pageFolder),
});

/**
 * 当前生成器配置
 *
 * 该对象是可变导出：生成器在调用时读取它，`config()` 会就地更新。直接修改字段会绕过 `config()` 的 `undefined` 忽略与末尾斜杠规范化， 因此业务代码应优先通过
 * `config()` 更新；直接访问主要用于读取当前配置。
 */
export const generatorConfig: Config = { ...DEFAULT_CONFIG };

/**
 * 恢复生成器默认配置
 *
 * 将 `generatorConfig` 的所有字段重置为内置默认值，主要供测试在修改配置后清理状态使用。
 */
export const resetConfig = (): void => {
  Object.assign(generatorConfig, DEFAULT_CONFIG);
};

/**
 * 配置生成器
 *
 * 只需传入要覆盖的字段：值为 `undefined` 的字段会被忽略，未传入的字段保持当前值（初始为默认值）。 `assets`、`icon`、`mapFolder`、`pageFolder`
 * 末尾的一个或多个斜杠会被移除。
 *
 * @param nextConfig 配置项，支持部分覆盖
 */
export const config = (nextConfig: Partial<Config> = {}): void => {
  const next: Config = { ...generatorConfig };

  for (const key of Object.keys(nextConfig) as (keyof Config)[]) {
    const value = nextConfig[key];

    if (value !== void 0) next[key] = value;
  }

  Object.assign(generatorConfig, normalizeConfig(next));
};
