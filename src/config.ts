interface Config {
  assets: string;
  icon: string;
  mapFolder: string;
  mapKey: string;
  pageFolder: string;
}

export const generatorConfig: Config = {
  assets: "",
  icon: "",
  mapKey: "",
  mapFolder: "",
  pageFolder: "page",
};

/**
 * 配置生成器
 *
 * @param assets 资源目录
 * @param icon 图标目录
 * @param mapFolder 地图目录
 * @param mapKey 地图密钥
 * @param pageFolder 页面目录
 */
export const config = ({ assets, icon, mapFolder, mapKey, pageFolder }: Config): void => {
  Object.assign(generatorConfig, {
    assets: assets.replace(/\/$/u, ""),
    icon: icon.replace(/\/$/u, ""),
    mapFolder,
    mapKey,
    pageFolder,
  });
};
