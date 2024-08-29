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

export const config = (options: Config): void => {
  Object.assign(_config, options);
};
