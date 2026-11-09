// oxlint-disable promise/prefer-await-to-callbacks -- 同步作用域开关，不涉及异步回调

let assetFileCheckEnabled = true;

/**
 * 当前是否启用资源文件存在性校验
 *
 * 资源仓在稀疏检出（没有 `img/` 等资源目录）时会以 `check: false` 生成数据，此时只应校验字段形状， 不能访问文件系统。
 *
 * @returns 是否启用资源文件存在性校验
 */
export const isAssetFileCheckEnabled = (): boolean => assetFileCheckEnabled;

/**
 * 在关闭资源文件存在性校验的作用域内执行回调
 *
 * 生成流程是同步的，解析期间不会与其他流程交错，因此可以使用模块级开关；回调结束后（包括抛错） 会恢复原值，支持嵌套调用。
 *
 * @param callback 需要关闭资源文件存在性校验的同步回调
 * @returns 回调的返回值
 */
export const withoutAssetFileCheck = <T>(callback: () => T): T => {
  const previous = assetFileCheckEnabled;

  assetFileCheckEnabled = false;

  try {
    return callback();
  } finally {
    assetFileCheckEnabled = previous;
  }
};
