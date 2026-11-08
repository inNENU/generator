import { describe, expect, it, onTestFinished, vi } from "vitest";
import type { Mock } from "vitest";

import { getWechatAccessToken } from "../src/helpers/accessToken.js";

// 构造 JSON 响应
const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  Response.json(body, init);

// 从 fetch 调用的入参中取出 URL 字符串
const getRequestURL = (input: Parameters<typeof fetch>[0]): string => {
  if (input instanceof URL) return input.href;
  if (typeof input === "string") return input;

  return input.url;
};

// 安装 fetch mock，避免真实网络请求，并在用例结束后恢复
const stubFetch = (createResponse: () => Response): Mock<typeof fetch> => {
  const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(createResponse()));

  vi.stubGlobal("fetch", fetchMock);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });

  return fetchMock;
};

describe("微信公众号 access_token", () => {
  it("encodes appid and secret as query parameters", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ access_token: "test-token", expires_in: 7200 }),
    );

    const appid = "wx&123 #test";
    const secret = "sec&ret #value";

    await expect(getWechatAccessToken(appid, secret)).resolves.toBe("test-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [[input]] = fetchMock.mock.calls;
    const url = new URL(getRequestURL(input));

    expect(`${url.origin}${url.pathname}`).toBe("https://api.weixin.qq.com/cgi-bin/token");
    expect(url.searchParams.get("grant_type")).toBe("client_credential");
    expect(url.searchParams.get("appid")).toBe(appid);
    expect(url.searchParams.get("secret")).toBe(secret);

    // 特殊字符必须被编码，不能把查询串拆散
    expect(url.href).not.toContain("wx&123");
    expect(url.href).not.toContain("sec&ret");
  });

  it("passes a timeout signal to fetch", async () => {
    const fetchMock = stubFetch(() => jsonResponse({ access_token: "test-token" }));

    await expect(getWechatAccessToken("appid", "secret")).resolves.toBe("test-token");

    const [[, init]] = fetchMock.mock.calls;

    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws on non-2xx HTTP status", async () => {
    stubFetch(() => new Response("oops", { status: 500, statusText: "Internal Server Error" }));

    await expect(getWechatAccessToken("appid", "secret")).rejects.toThrow(/HTTP 500/u);
  });

  it("throws with errcode and errmsg when wechat returns an error", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ errcode: 40001, errmsg: "invalid credential" }),
    );

    await expect(getWechatAccessToken("appid", "secret")).rejects.toThrow(/错误码 40001/u);
    await expect(getWechatAccessToken("appid", "secret")).rejects.toThrow(/invalid credential/u);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when access_token is missing", async () => {
    stubFetch(() => jsonResponse({ expires_in: 7200 }));

    await expect(getWechatAccessToken("appid", "secret")).rejects.toThrow(/access_token/u);
  });

  it("returns the token on success", async () => {
    stubFetch(() =>
      jsonResponse({ access_token: "access-token-value", errcode: 0, expires_in: 7200 }),
    );

    await expect(getWechatAccessToken("appid", "secret")).resolves.toBe("access-token-value");
  });

  it("throws when the response body is not valid JSON", async () => {
    stubFetch(() => new Response("not json", { status: 200 }));

    await expect(getWechatAccessToken("appid", "secret")).rejects.toThrow(/JSON/u);
  });
});
