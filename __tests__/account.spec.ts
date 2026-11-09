import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { JSON_SCHEMA, load } from "js-yaml";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import type { Mock } from "vitest";

import {
  fetchAccountPage,
  formatAccountText,
  updateAccountFile,
} from "../src/generator/account.js";

// 解析序列化后的 YAML 标量，模拟写入账号文件后的读取
const parseScalar = (serialized: string): unknown =>
  (load(`value: ${serialized}`, { schema: JSON_SCHEMA }) as { value: unknown }).value;

// 创建测试用临时文件夹，并在用例结束后清理
const makeTempFolder = (): string => {
  const folder = mkdtempSync(path.join(tmpdir(), "innenu-account-"));

  onTestFinished(() => {
    rmSync(folder, { force: true, recursive: true });
  });

  return folder;
};

// 安装 fetch mock，避免真实网络请求，并在用例结束后恢复
const stubFetch = (implementation: typeof fetch): Mock<typeof fetch> => {
  const fetchMock = vi.fn<typeof fetch>(implementation);

  vi.stubGlobal("fetch", fetchMock);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });

  return fetchMock;
};

// 构造带 OGP 元数据的账号页面响应
const ogpResponse = (title: string, desc: string): Response =>
  new Response(
    [
      "<html><head>",
      '<meta property="og:image" content="https://example.com/cover.png" />',
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${desc}" />`,
      "</head></html>",
    ].join("\n"),
    { status: 200 },
  );

describe(formatAccountText, () => {
  it.each([
    ["backslashes", String.raw`C:\Users\innenu\account`],
    ["double quotes", 'He said "hello"'],
    ["a real newline", "line one\nline two"],
    ["quotes and backslashes", String.raw`It's "C:\Users\new"`],
    ["a leading at sign", "@innenu"],
    ["a colon followed by a space", "note: keep this"],
    ["a hash after a space", "foo # bar"],
    ["a leading bracket", "[draft] title"],
  ])("round-trips %s through js-yaml", (_name, value) => {
    expect(parseScalar(formatAccountText(value))).toBe(value);
  });

  it("still decodes HTML entities and escaped line breaks", () => {
    const value = String.raw`&quot;A&quot; &amp; &#39;B&#39;\x0aC`;

    expect(parseScalar(formatAccountText(value))).toBe(`"A" & 'B' C`);
  });
});

describe(fetchAccountPage, () => {
  it("passes a timeout signal and returns the response body", async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response("page body", { status: 200 })));
    const url = "https://example.com/post/1";

    await expect(fetchAccountPage(url)).resolves.toBe("page body");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [[input, init]] = fetchMock.mock.calls;

    expect(input).toBe(url);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(false);
  });

  it("throws a Chinese error containing the URL and HTTP status", async () => {
    stubFetch(() =>
      Promise.resolve(new Response("oops", { status: 500, statusText: "Internal Server Error" })),
    );

    const url = "https://example.com/post/1";

    await expect(fetchAccountPage(url)).rejects.toThrow(/获取账号页面失败/u);
    await expect(fetchAccountPage(url)).rejects.toThrow(url);
    await expect(fetchAccountPage(url)).rejects.toThrow(/HTTP 500/u);
  });

  it("throws a Chinese timeout error containing the URL", async () => {
    stubFetch(() =>
      Promise.reject(new DOMException("The operation was aborted due to timeout", "TimeoutError")),
    );

    const url = "https://example.com/post/1";

    await expect(fetchAccountPage(url)).rejects.toThrow(/获取账号页面超时/u);
    await expect(fetchAccountPage(url)).rejects.toThrow(url);
  });

  it("wraps other network errors with the URL", async () => {
    stubFetch(() => Promise.reject(new Error("fetch failed")));

    const url = "https://example.com/post/1";

    await expect(fetchAccountPage(url)).rejects.toThrow(/获取账号页面失败/u);
    await expect(fetchAccountPage(url)).rejects.toThrow(/fetch failed/u);
    await expect(fetchAccountPage(url)).rejects.toThrow(url);
  });
});

describe(updateAccountFile, () => {
  it("writes fetched metadata as YAML that js-yaml can parse", async () => {
    const folder = makeTempFolder();
    const filename = "account.yaml";
    const filePath = path.join(folder, filename);
    const title = String.raw`[draft] It's "C:\Users\new"`;
    const desc = "inNENU account description";
    const url = "https://example.com/post/1";

    writeFileSync(filePath, `  - url: ${url}\n`, "utf-8");

    const fetchMock = stubFetch(() => Promise.resolve(ogpResponse(title, desc)));

    await updateAccountFile(folder, filename);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [[input, init]] = fetchMock.mock.calls;

    expect(input).toBe(url);
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    const parsed = load(readFileSync(filePath, "utf-8"), {
      schema: JSON_SCHEMA,
    }) as Record<string, unknown>[];

    expect(parsed).toStrictEqual([
      {
        cover: "https://example.com/cover.png",
        title,
        desc,
        url,
      },
    ]);

    // 原子写入完成后不应残留临时文件
    expect(readdirSync(folder)).toStrictEqual([filename]);
  });
});
