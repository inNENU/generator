/** 微信 access_token 接口地址 */
const ACCESS_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";

/** 请求超时时间（毫秒） */
const ACCESS_TOKEN_TIMEOUT = 10_000;

/** 微信 access_token 接口响应体 */
interface WechatAccessTokenResponse {
  access_token?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * 获取微信公众号 access_token
 *
 * @param appid 微信公众号 AppID
 * @param secret 微信公众号 AppSecret
 * @returns Access_token
 */
export const getWechatAccessToken = async (appid: string, secret: string): Promise<string> => {
  // 通过 searchParams 设置参数，保证 appid / secret 中的特殊字符被正确编码
  const url = new URL(ACCESS_TOKEN_URL);

  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);

  const response = await fetch(url, { signal: AbortSignal.timeout(ACCESS_TOKEN_TIMEOUT) });

  if (!response.ok)
    throw new Error(`获取微信 access_token 失败：HTTP ${response.status} ${response.statusText}`);

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error("获取微信 access_token 失败：响应不是有效的 JSON");
  }

  // 先确认响应体是普通对象，避免 null / 字符串 / 数组时读取字段抛出 TypeError
  if (typeof data !== "object" || data == null || Array.isArray(data))
    throw new Error("获取微信 access_token 失败：响应不是有效的 JSON 对象");

  const { access_token: accessToken, errcode, errmsg } = data as WechatAccessTokenResponse;

  if (typeof errcode === "number" && errcode !== 0) {
    throw new Error(
      `获取微信 access_token 失败：微信返回错误码 ${errcode}（${errmsg ?? "未提供错误信息"}）`,
    );
  }

  if (!accessToken) throw new Error("获取微信 access_token 失败：响应中缺少 access_token");

  return accessToken;
};
