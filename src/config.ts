interface Config {
  assets: string;
  icon: string;
  mapFolder: string;
  mapKey: string;
}

export const _config: Config = {
  assets: "",
  icon: "",
  mapKey: "",
  mapFolder: "",
};

export const config = ({ assets, icon, mapFolder, mapKey }: Config): void => {
  Object.assign(_config, {
    assets: assets.replace(/\/$/, ""),
    icon: icon.replace(/\/$/, ""),
    mapFolder,
    mapKey,
  });
};
