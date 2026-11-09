import { describe, expect, it } from "vitest";
import * as zod from "zod";

import { accountSchema } from "../src/component-schema.js";
import { finalizeJsonSchema } from "../src/helpers/json-schema.js";
import { pageConfigSchema, pageContentSchema } from "../src/page/schema.js";
import { fileSchema, httpsLinkSchema, imgSchema } from "../src/schema/common.js";

type JsonSchema = zod.core.JSONSchema.JSONSchema;
type Definitions = Record<string, JsonSchema>;

const DRAFT_07 = "http://json-schema.org/draft-07/schema#";

/** 文本组件允许的标签 */
const TEXT_TAGS = new Set(["text", "p", "ol", "ul"]);

/** 组件 `tag` 的全部取值 */
const COMPONENT_TAGS = [
  "account",
  "action",
  "audio",
  "card",
  "carousel",
  "doc",
  "footer",
  "functional-list",
  "grid",
  "img",
  "list",
  "location",
  "ol",
  "p",
  "phone",
  "table",
  "text",
  "title",
  "ul",
  "video",
];

/**
 * 解析 `$ref`
 *
 * @param schema 待解析的 schema
 * @param definitions 定义表
 * @param seen 已解析的引用，避免循环
 * @returns 解析后的 schema
 */
const resolveRef = (
  schema: JsonSchema,
  definitions: Definitions,
  seen: Set<string>,
): JsonSchema => {
  const ref = schema.$ref;

  if (!ref) return schema;

  const name = ref.split("/").pop();
  const target = name ? definitions[name] : undefined;

  if (!name || !target || seen.has(name)) return schema;

  return resolveRef(target, definitions, new Set([...seen, name]));
};

/**
 * 收集所有带 `tag` 的叶子分支
 *
 * @param schema 待遍历的 schema
 * @param definitions 定义表
 * @param seen 已解析的引用，避免循环
 * @returns 带 `tag` 的叶子分支
 */
const collectTagBranches = (
  schema: JsonSchema,
  definitions: Definitions,
  seen: Set<string> = new Set<string>(),
): JsonSchema[] => {
  const resolved = resolveRef(schema, definitions, seen);
  const branches = resolved.oneOf ?? resolved.anyOf;

  if (branches)
    return branches.flatMap((branch) => collectTagBranches(branch, definitions, new Set(seen)));

  const tag = resolved.properties?.tag;

  return typeof tag === "object" && tag != null ? [resolved] : [];
};

/**
 * 读取分支的 `tag` schema
 *
 * @param schema 分支 schema
 * @returns `tag` schema
 */
const getTagSchema = (schema: JsonSchema): JsonSchema => schema.properties?.tag as JsonSchema;

describe("生成的 JSON Schema", () => {
  it("页面配置的根标题在 $ref 旁保留", () => {
    const jsonSchema = finalizeJsonSchema(
      zod.toJSONSchema(pageConfigSchema, { target: "draft-07" }),
      "Page Config",
    );

    expect(jsonSchema.$schema).toBe(DRAFT_07);
    expect(jsonSchema.title).toBe("Page Config");
    expect(jsonSchema.$ref).toBeUndefined();
    expect(jsonSchema.allOf).toStrictEqual([{ $ref: "#/definitions/page-config" }]);
  });

  it("页面内容按 tag 判别，且每个分支都有字面量 tag", () => {
    const jsonSchema = finalizeJsonSchema(
      zod.toJSONSchema(pageContentSchema, { target: "draft-07" }),
      "Page Content",
    );
    const definitions = jsonSchema.definitions as Definitions;
    const { component } = definitions;

    expect(jsonSchema.title).toBe("Page Content");
    expect(jsonSchema.allOf).toStrictEqual([{ $ref: "#/definitions/page-content" }]);
    expect(component.oneOf).toHaveLength(17);

    const branches = collectTagBranches(component, definitions);
    const tags = branches.map((branch) => getTagSchema(branch).const);

    expect(branches).toHaveLength(63);
    expect(new Set(tags)).toStrictEqual(new Set(COMPONENT_TAGS));
    expect(tags.every((tag) => typeof tag === "string")).toBe(true);
  });

  it("卡片与文本分支保留字面量 tag", () => {
    const jsonSchema = finalizeJsonSchema(
      zod.toJSONSchema(pageContentSchema, { target: "draft-07" }),
      "Page Content",
    );
    const definitions = jsonSchema.definitions as Definitions;
    const { "card-component": card, "text-component": text } = definitions;
    const cardBranches = card.anyOf!;
    const textBranches = text.anyOf!;

    expect(cardBranches).toHaveLength(8);
    expect(cardBranches.every((branch) => getTagSchema(branch).const === "card")).toBe(true);
    expect(textBranches).toHaveLength(40);
    expect(
      textBranches.every((branch) => TEXT_TAGS.has(getTagSchema(branch).const as string)),
    ).toBe(true);
  });

  it("单个组件 schema 保留根标题与 tag 判别", () => {
    const jsonSchema = finalizeJsonSchema(
      zod.toJSONSchema(accountSchema, { target: "draft-07" }),
      "Account Component",
    );
    const definitions = jsonSchema.definitions as Definitions;
    const account = definitions["account-component"];

    expect(jsonSchema.$schema).toBe(DRAFT_07);
    expect(jsonSchema.title).toBe("Account Component");
    expect(jsonSchema.allOf).toStrictEqual([{ $ref: "#/definitions/account-component" }]);
    expect(getTagSchema(account).const).toBe("account");
  });

  it("httpsLinkSchema 的 JSON Schema 保留 https 约束", () => {
    const jsonSchema = zod.toJSONSchema(httpsLinkSchema, { target: "draft-07" });

    expect(jsonSchema.$schema).toBe(DRAFT_07);
    expect(jsonSchema.pattern).toBe(String.raw`^https:\/\/`);
    expect(httpsLinkSchema.safeParse("https://example.com").success).toBe(true);
    expect(httpsLinkSchema.safeParse("HTTPS://EXAMPLE.COM").success).toBe(true);
    expect(httpsLinkSchema.safeParse("http://example.com").success).toBe(false);
  });

  it("imgSchema 的 JSON Schema 保留站内图片 pattern", () => {
    const { anyOf } = zod.toJSONSchema(imgSchema, { target: "draft-07" });
    const branches = anyOf!;

    expect(branches).toHaveLength(2);
    expect(branches[0].pattern).toBe(String.raw`^https:\/\/`);
    expect(branches[1].pattern).toContain(String.raw`^\$img`);
    expect(branches[1].pattern).toContain("png|jpg|jpeg");
    expect(branches[1].pattern).toContain("[?#]");
  });

  it("fileSchema 的 JSON Schema 保留站内文件 pattern", () => {
    const { anyOf } = zod.toJSONSchema(fileSchema, { target: "draft-07" });
    const branches = anyOf!;

    expect(branches).toHaveLength(2);
    expect(branches[0].pattern).toBe(String.raw`^https:\/\/`);
    expect(branches[1].pattern).toContain(String.raw`^\$file`);
  });
});
