# CLAUDE.md

## Project Overview

- **Project name**: inNENU-generator
- **Type**: Node.js library/tool
- **Core functionality**: A content generator for inNENU (WeChat miniapp and VuePress)
- **Language**: TypeScript
- **Package manager**: pnpm

## Project Structure

```
src/
├── index.ts              # Main entry point
├── config.ts             # Configuration management
├── typings.ts            # TypeScript type definitions
├── utils.ts              # Utility functions
├── knowledge.ts          # Knowledge-related code
├── components/           # Component generators (JSON schemas + markdown)
│   ├── account/
│   ├── action/
│   ├── audio/
│   ├── card/
│   ├── carousel/
│   ├── doc/
│   ├── footer/
│   ├── grid/
│   ├── img/
│   ├── list/
│   ├── location/
│   ├── phone/
│   ├── table/
│   ├── text/
│   ├── title/
│   └── video/
├── generator/            # Generator modules
│   ├── account.ts
│   ├── map.ts
│   ├── music.ts
│   ├── pageIndexes.ts
│   ├── svgIcons.ts
│   └── index.ts
├── helpers/              # Utility helpers
│   ├── accessToken.ts
│   ├── checkAssets.ts
│   ├── getFileList.ts
│   ├── getFileMap.ts
│   ├── git.ts
│   ├── json.ts
│   ├── oss.ts
│   ├── promiseQueue.ts
│   ├── svg.ts
│   ├── wordCount.ts
│   └── yaml.ts
├── page/                 # Page generation
│   ├── json.ts
│   ├── markdown.ts
│   ├── schema.ts
│   ├── text.ts
│   └── index.ts
└── schema/               # Schema definitions
    ├── account.ts
    ├── common.ts
    ├── map.ts
    ├── music.ts
    ├── pageIndexes.ts
    └── index.ts
```

## Commands

- `pnpm build` - Build with tsdown (outputs to dist/)
- `pnpm test` - Run vitest tests
- `pnpm lint` - Run oxlint and oxfmt
- `pnpm schema` - Generate schema files
- `pnpm clean` - Clean dist folder

## Tech Stack

- **Runtime**: Node.js ^20.19.0 || >=22.12.0
- **Build**: tsdown
- **Testing**: vitest
- **Linting**: oxlint, oxfmt
- **Dependencies**:
  - ali-oss (Alibaba Cloud OSS)
  - js-yaml
  - upath
  - zod

## Key Patterns

- Components follow a pattern: each has `json.ts`, `markdown.ts`, and `schema.ts`
- Generators export specific functionality (account, map, music, pageIndexes, svgIcons)
- Helpers provide file handling, OSS integration, git utilities, etc.
- Configuration is managed via `config()` function that updates `_config` object
