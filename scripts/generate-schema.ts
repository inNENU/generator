#!/usr/bin/env unrun
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ZodType } from "zod";
import { toJSONSchema } from "zod";

import { finalizeJsonSchema } from "../src/helpers/json-schema.js";
import { componentSchema, pageConfigSchema } from "../src/page/index.js";
import {
  mapPageConfigSchema,
  markersConfigSchema,
  qqAccountsSchema,
  wechatAccountDataSchema,
  wechatAccountsSchema,
} from "../src/schema/index.js";

const __dirname = import.meta.dirname;

// 输出目录
const SCHEMA_DIR = path.join(__dirname, "..", "schemas");

// 确保输出目录存在
if (!existsSync(SCHEMA_DIR)) mkdirSync(SCHEMA_DIR, { recursive: true });

/**
 * 清理上一次生成、本次可能不再产出的 JSON Schema
 *
 * `schemas/` 是生成产物目录：组件或配置改名后旧文件会残留，并随 `files` 一起被打包，因此在生成前清空其中的 `*.json`。
 */
const cleanSchemaDir = (): void => {
  for (const file of readdirSync(SCHEMA_DIR))
    if (file.endsWith(".json")) rmSync(path.join(SCHEMA_DIR, file), { force: true });
};

/**
 * 生成 JSON Schema 文件
 *
 * @param schema Zod 模式对象
 * @param filename 输出文件名
 * @param title JSON Schema 标题（可选）
 */
const generateJsonSchema = (schema: ZodType, filename: string, title?: string): void => {
  try {
    const jsonSchema = finalizeJsonSchema(
      toJSONSchema(schema, {
        target: "draft-07",
      }),
      title,
    );

    if (jsonSchema.$schema !== "http://json-schema.org/draft-07/schema#")
      throw new Error(`Unexpected JSON Schema version: ${String(jsonSchema.$schema)}`);

    const filePath = path.join(SCHEMA_DIR, filename);

    writeFileSync(filePath, JSON.stringify(jsonSchema), "utf-8");
    console.log(`✅ Generated ${filename}`);
  } catch (err) {
    console.error(`❌ Failed to generate ${filename}:`, err);
    process.exitCode = 1;
  }
};

/** 主函数 */
const main: () => void = () => {
  console.log("🚀 Generating JSON Schemas...\n");

  cleanSchemaDir();

  generateJsonSchema(pageConfigSchema, "page-config.schema.json", "Page Config");
  generateJsonSchema(componentSchema, "component.schema.json", "Page Components");

  generateJsonSchema(qqAccountsSchema, "qq-accounts.schema.json", "QQ Accounts");
  generateJsonSchema(wechatAccountsSchema, "wechat-accounts.schema.json", "WeChat Accounts");
  generateJsonSchema(
    wechatAccountDataSchema,
    "wechat-account-data.schema.json",
    "WeChat Account Data",
  );
  generateJsonSchema(mapPageConfigSchema, "map-page-config.schema.json", "Map Page Config");
  generateJsonSchema(markersConfigSchema, "map-markers.schema.json", "Map Markers");
};

// 运行脚本
main();
