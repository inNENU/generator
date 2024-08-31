interface Config {
  assets: string;
  icon: string;
  mapFolder: string;
  mapKey: string;
  pageFolder: string;
}

export const _config: Config = {
  assets: "",
  icon: "",
  mapKey: "",
  mapFolder: "",
  pageFolder: "page",
};

export const config = ({
  assets,
  icon,
  mapFolder,
  mapKey,
  pageFolder,
}: Config): void => {
  Object.assign(_config, {
    assets: assets.replace(/\/$/, ""),
    icon: icon.replace(/\/$/, ""),
    mapFolder,
    mapKey,
    pageFolder,
  });
};
