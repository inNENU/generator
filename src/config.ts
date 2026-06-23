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

export const config = ({ assets, icon, mapFolder, mapKey, pageFolder }: Config): void => {
  Object.assign(generatorConfig, {
    assets: assets.replace(/\/$/u, ""),
    icon: icon.replace(/\/$/u, ""),
    mapFolder,
    mapKey,
    pageFolder,
  });
};
