// oxlint-disable vitest/no-hooks -- 每个用例都需要重置假凭据、mock 与 OSS 客户端
// oxlint-disable vitest/prefer-import-in-mock -- 需要在用例内共享 mock 函数以断言之
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  initOSS,
  normalizeObjectKey,
  removeOSSFiles,
  resetOSSClient,
  uploadOSSFiles,
} from "../src/helpers/oss.js";

interface OSSResponse {
  res: { status: number };
}

type PutMock = (
  key: string,
  localPath: string,
  options: { headers: Record<string, string> },
) => Promise<OSSResponse>;

type DeleteMultiMock = (keys: string[]) => Promise<OSSResponse>;

const mocks = vi.hoisted(() => ({
  put: vi.fn<PutMock>(),
  deleteMulti: vi.fn<DeleteMultiMock>(),
}));

vi.mock("ali-oss", () => {
  class MockOSS {
    put = mocks.put;
    deleteMulti = mocks.deleteMulti;
  }

  return { default: MockOSS };
});

/** 测试用假凭据，避免读取真实环境变量 */
const ENV = {
  OSS_KEY_ID: "test-key-id",
  OSS_KEY_SECRET: "test-key-secret",
  OSS_REGION: "oss-cn-test",
  OSS_BUCKET: "test-bucket",
} as const;

const headers = {
  "x-oss-storage-class": "Standard",
  "x-oss-object-acl": "private",
};

describe("oss helpers", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);

    mocks.put.mockReset().mockResolvedValue({ res: { status: 200 } });
    mocks.deleteMulti.mockReset().mockResolvedValue({ res: { status: 200 } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetOSSClient();
  });

  describe(normalizeObjectKey, () => {
    it("should keep a normal relative key", () => {
      expect(normalizeObjectKey("assets/images/logo.png")).toBe("assets/images/logo.png");
    });

    it("should strip the leading ./", () => {
      expect(normalizeObjectKey("./assets/logo.png")).toBe("assets/logo.png");
      expect(normalizeObjectKey("././assets/logo.png")).toBe("assets/logo.png");
    });

    it("should strip the leading /", () => {
      expect(normalizeObjectKey("/assets/logo.png")).toBe("assets/logo.png");
      expect(normalizeObjectKey("//assets/logo.png")).toBe("assets/logo.png");
      expect(normalizeObjectKey("/./assets/logo.png")).toBe("assets/logo.png");
    });

    it("should keep dots inside file names", () => {
      expect(normalizeObjectKey("assets/logo.min.png")).toBe("assets/logo.min.png");
    });

    it("should reject an empty key", () => {
      expect(() => normalizeObjectKey("")).toThrow(/OSS 对象 key 非法.*不能为空/u);
      expect(() => normalizeObjectKey("   ")).toThrow(/OSS 对象 key 非法.*不能为空/u);
      expect(() => normalizeObjectKey("/")).toThrow(/OSS 对象 key 非法.*不能为空/u);
      expect(() => normalizeObjectKey("./")).toThrow(/OSS 对象 key 非法.*不能为空/u);
    });

    it("should reject . and .. path segments", () => {
      expect(() => normalizeObjectKey(".")).toThrow(/不能包含 "\." 或 "\.\." 路径段/u);
      expect(() => normalizeObjectKey("..")).toThrow(/不能包含 "\." 或 "\.\." 路径段/u);
      expect(() => normalizeObjectKey("assets/../secret.png")).toThrow(/路径段/u);
      expect(() => normalizeObjectKey("assets/./logo.png")).toThrow(/路径段/u);
    });

    it("should reject empty path segments", () => {
      expect(() => normalizeObjectKey("assets//logo.png")).toThrow(/空路径段/u);
      expect(() => normalizeObjectKey("assets/")).toThrow(/空路径段/u);
    });

    it("should reject backslashes", () => {
      expect(() => normalizeObjectKey(String.raw`C:\Windows\logo.png`)).toThrow(/不能包含反斜杠/u);
      expect(() => normalizeObjectKey(String.raw`assets\logo.png`)).toThrow(/不能包含反斜杠/u);
    });

    it("should reject local absolute paths and URLs", () => {
      expect(() => normalizeObjectKey("C:/Windows/logo.png")).toThrow(/绝对路径或 URL/u);
      expect(() => normalizeObjectKey("file:///tmp/logo.png")).toThrow(/绝对路径或 URL/u);
      expect(() => normalizeObjectKey("http://example.com/logo.png")).toThrow(/绝对路径或 URL/u);
    });

    it("should reject home directory references", () => {
      expect(() => normalizeObjectKey("~/secret.png")).toThrow(/家目录/u);
      expect(() => normalizeObjectKey("~")).toThrow(/家目录/u);
    });

    it("should reject control characters", () => {
      expect(() => normalizeObjectKey("assets/logo\u0000.png")).toThrow(/控制字符/u);
    });

    it("should reject non-string input", () => {
      expect(() => normalizeObjectKey(undefined as unknown as string)).toThrow(/必须是字符串/u);
    });
  });

  describe(removeOSSFiles, () => {
    it("should delete normalized keys", async () => {
      await removeOSSFiles(["./assets/logo.png", "/pages/index.json"]);

      expect(mocks.deleteMulti).toHaveBeenCalledTimes(1);
      expect(mocks.deleteMulti).toHaveBeenCalledWith(["assets/logo.png", "pages/index.json"]);
    });

    it("should not initialize OSS for an empty list", async () => {
      vi.unstubAllEnvs();

      await expect(removeOSSFiles([])).resolves.toBeUndefined();
      expect(mocks.deleteMulti).not.toHaveBeenCalled();
    });

    it("should reject keys outside the allowed prefix before deleting anything", async () => {
      await expect(
        removeOSSFiles(["assets/a.png", "other/b.png"], { prefix: "assets/" }),
      ).rejects.toThrow(/other\/b\.png/u);

      expect(mocks.deleteMulti).not.toHaveBeenCalled();
    });

    it("should treat a prefix without trailing slash as a directory prefix", async () => {
      await removeOSSFiles(["assets/a.png"], { prefix: "assets" });

      expect(mocks.deleteMulti).toHaveBeenCalledWith(["assets/a.png"]);
    });

    it("should not match sibling directories sharing a string prefix", async () => {
      await expect(removeOSSFiles(["assets-old/a.png"], { prefix: "assets" })).rejects.toThrow(
        /assets-old\/a\.png/u,
      );
      expect(mocks.deleteMulti).not.toHaveBeenCalled();
    });

    it("should normalize the allowed prefix", async () => {
      await removeOSSFiles(["/assets/a.png"], { prefix: "/assets/" });

      expect(mocks.deleteMulti).toHaveBeenCalledWith(["assets/a.png"]);
    });

    it("should reject invalid keys before deleting anything", async () => {
      vi.unstubAllEnvs();

      await expect(removeOSSFiles(["../secret.png"], { prefix: "assets/" })).rejects.toThrow(
        /OSS 对象 key 非法/u,
      );
      expect(mocks.deleteMulti).not.toHaveBeenCalled();
    });

    it("should reject an invalid prefix", async () => {
      await expect(removeOSSFiles(["assets/a.png"], { prefix: "../assets" })).rejects.toThrow(
        /OSS 删除前缀非法/u,
      );
      expect(mocks.deleteMulti).not.toHaveBeenCalled();
    });

    it("should aggregate delete failures without losing later keys", async () => {
      mocks.deleteMulti.mockResolvedValueOnce({ res: { status: 500 } });

      await expect(removeOSSFiles(["assets/a.png", "assets/b.png"])).rejects.toThrow(
        /部分文件删除 OSS 失败（2 个）: assets\/a\.png, assets\/b\.png/u,
      );
    });

    it("should keep the original error when deleteMulti rejects", async () => {
      mocks.deleteMulti.mockRejectedValueOnce(new Error("网络错误"));

      await expect(removeOSSFiles(["assets/a.png"])).rejects.toThrow(/部分文件删除 OSS 失败/u);
      expect(mocks.deleteMulti).toHaveBeenCalledTimes(1);
    });
  });

  describe(uploadOSSFiles, () => {
    it("should upload with normalized online keys", async () => {
      await uploadOSSFiles([{ local: "/tmp/local.png", online: "/assets/logo.png" }]);

      expect(mocks.put).toHaveBeenCalledWith("assets/logo.png", "/tmp/local.png", { headers });
    });

    it("should use the same path for string entries", async () => {
      await uploadOSSFiles(["./assets/logo.png"]);

      expect(mocks.put).toHaveBeenCalledWith("assets/logo.png", "./assets/logo.png", { headers });
    });

    it("should reject invalid online keys before uploading anything", async () => {
      vi.unstubAllEnvs();

      await expect(
        uploadOSSFiles([{ local: "/tmp/local.png", online: "C:/Windows/logo.png" }]),
      ).rejects.toThrow(/OSS 对象 key 非法/u);
      expect(mocks.put).not.toHaveBeenCalled();
    });

    it("should limit concurrency to 5", async () => {
      let active = 0;
      let maxActive = 0;

      mocks.put.mockImplementation(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
        active -= 1;

        return { res: { status: 200 } };
      });

      await uploadOSSFiles(Array.from({ length: 20 }, (_, index) => `assets/${String(index)}.png`));

      expect(maxActive).toBeGreaterThan(1);
      expect(maxActive).toBeLessThanOrEqual(5);
      expect(mocks.put).toHaveBeenCalledTimes(20);
    });

    it("should keep uploading after a failure and aggregate failures", async () => {
      mocks.put
        .mockResolvedValue({ res: { status: 200 } })
        .mockRejectedValueOnce(new Error("模拟上传失败"));

      await expect(uploadOSSFiles(["assets/bad.png", "assets/ok.png"])).rejects.toThrow(
        /部分文件上传 OSS 失败（1 个）: assets\/bad\.png/u,
      );
      expect(mocks.put).toHaveBeenCalledTimes(2);
    });

    it("should report non-200 responses as failures", async () => {
      mocks.put.mockResolvedValueOnce({ res: { status: 500 } });

      const error = await uploadOSSFiles(["assets/fail.png"]).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toHaveLength(1);
      expect((error as AggregateError).errors[0]).toMatchObject({
        message: "上传 assets/fail.png 失败：HTTP 500",
      });
    });
  });

  describe(initOSS, () => {
    it.each(["OSS_KEY_ID", "OSS_KEY_SECRET", "OSS_REGION", "OSS_BUCKET"] as const)(
      "should throw when %s is missing",
      (key) => {
        vi.stubEnv(key, undefined);

        expect(() => initOSS()).toThrow(new RegExp(`缺少环境变量 ${key}`, "u"));
      },
    );

    it("should list all missing environment variables", () => {
      vi.unstubAllEnvs();

      expect(() => initOSS()).toThrow(
        /缺少环境变量 OSS_KEY_ID、OSS_KEY_SECRET、OSS_REGION、OSS_BUCKET/u,
      );
    });

    it("should initialize with all required environment variables", () => {
      expect(() => initOSS()).not.toThrow();
      expect(() => initOSS()).not.toThrow();
    });

    it("should rebuild the client after resetOSSClient", () => {
      initOSS();
      vi.stubEnv("OSS_BUCKET", undefined);

      expect(() => initOSS()).not.toThrow();

      resetOSSClient();

      expect(() => initOSS()).toThrow(/OSS_BUCKET/u);
    });
  });
});
