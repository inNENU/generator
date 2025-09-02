#!/usr/bin/env tsx

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as zod from "zod";

import { componentSchema, pageConfigSchema } from "../src/page/index.js";
import {
  mapPageConfigSchema,
  markersConfigSchema,
  qqAccountsSchema,
  wechatAccountDataSchema,
  wechatAccountsSchema,
} from "../src/schema/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 输出目录
const SCHEMA_DIR = join(__dirname, "..", "schemas");

// 确保输出目录存在
if (!existsSync(SCHEMA_DIR)) {
  mkdirSync(SCHEMA_DIR, { recursive: true });
}

/**
 * 生成 JSON Schema 文件
 */
function generateJsonSchema(
  schema: zod.ZodObject | zod.ZodRecord | zod.ZodUnion | zod.ZodArray,
  filename: string,
  title?: string,
): void {
  try {
    // 使用 zod 内置的 .schema() 方法生成 JSON Schema
    const jsonSchema = zod.toJSONSchema(schema, {
      target: "draft-7",
    });

    // 添加标题和描述
    if (title) {
      jsonSchema.title = title;
    }

    const filePath = join(SCHEMA_DIR, filename);

    writeFileSync(filePath, JSON.stringify(jsonSchema, null, 2), "utf8");
    console.log(`✅ Generated ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to generate ${filename}:`, error);
  }
}

/**
 * 主函数
 */
function main(): void {
  console.log("🚀 Generating JSON Schemas...\n");

  generateJsonSchema(
    pageConfigSchema,
    "page-config.schema.json",
    "Page Config",
  );
  generateJsonSchema(
    componentSchema,
    "component.schema.json",
    "Page Components",
  );

  generateJsonSchema(
    qqAccountsSchema,
    "qq-accounts.schema.json",
    "QQ Accounts",
  );
  generateJsonSchema(
    wechatAccountsSchema,
    "wechat-accounts.schema.json",
    "WeChat Accounts",
  );
  generateJsonSchema(
    wechatAccountDataSchema,
    "wechat-account-data.schema.json",
    "WeChat Account Data",
  );
  generateJsonSchema(
    mapPageConfigSchema,
    "map-page-config.schema.json",
    "Map Page Config",
  );
  generateJsonSchema(
    markersConfigSchema,
    "map-markers.schema.json",
    "Map Markers",
  );
}

// 运行脚本
main();
