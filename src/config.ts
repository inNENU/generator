interface Config {
  accountFolder: string;
  assets: string;
  icon: string;
  mapFolder: string;
  mapKey: string;
}

export const _config: Config = {
  accountFolder: "",
  assets: "",
  icon: "",
  mapKey: "",
  mapFolder: "",
};

export const config = ({
  accountFolder,
  assets,
  icon,
  mapFolder,
  mapKey,
}: Config): void => {
  Object.assign(_config, {
    accountFolder,
    assets: assets.replace(/\/$/, ""),
    icon: icon.replace(/\/$/, ""),
    mapFolder,
    mapKey,
  });
};
