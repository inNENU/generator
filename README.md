# innenu-generator

Content generator for [inNENU](https://github.com/inNENU), producing the data consumed by the WeChat miniapp and the VuePress site from the repository's YAML/Markdown sources.

## Requirements

- Node.js `>=22.12.0` (supported LTS lines). CI currently runs the test suite on Node 26 only, so older LTS lines are supported but not covered by CI.
- pnpm `12.18.0` (declared through `devEngines`)

## Installation

```bash
pnpm add innenu-generator
```

## Usage

Configure the generator once at startup, then call the generators for the content you need:

```ts
import { config, getPageJSON, getPageMarkdown, getPageText } from "innenu-generator";
import type { PageConfig } from "innenu-generator";

config({
  assets: "https://assets.innenu.com",
  icon: "https://res.innenu.com/icons",
  mapFolder: "./data/function/map",
  mapKey: "<your map key>",
  pageFolder: "./pages",
});

const page: PageConfig = {
  title: "Home",
  content: [{ tag: "text", text: "Welcome to inNENU." }],
};

const pageJSON = getPageJSON(page, "home", [], { check: true });
const pageMarkdown = getPageMarkdown(page, { location: "home", mode: "web" });
const pageText = getPageText(page, "home");
```

Page generators take a `PageConfig` object as their first argument; the page path is passed separately (as the second argument) where the
generator needs it.

`config()` accepts:

| Option       | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| `assets`     | Public assets base URL, used by `$` file aliases and icon links |
| `icon`       | Icon base directory                                             |
| `mapFolder`  | Directory containing map pages and marker data                  |
| `mapKey`     | Tencent map key                                                 |
| `pageFolder` | Directory containing page YAML files                            |

## Markdown output

Markdown generation targets the VuePress site only. The WeChat miniapp and the native App consume the JSON artifacts, so there is no
Markdown rendering requirement for them; the `env` field is therefore respected only for `"web"` in the Markdown pipeline (components
marked for other environments are skipped there by design). Use `getPageJSON` for Mini Program / App content.

## Entry points

- `innenu-generator`: full public API (page, component, schema, helpers, generators).
- `innenu-generator/schema`: zod schemas and validators for page components (`textComponentSchema`, `checkText`, ...). This subpath does
  not include the page config schema.
- `innenu-generator/typings`: type-only subpath with the shared TypeScript types.

### JSON Schema files

`pnpm run schema` generates draft-07 JSON Schema files into `schemas/`. They are published with the package and exposed through the
`innenu-generator/schemas/*` export:

```ts
import pageConfigSchema from "innenu-generator/schemas/page-config.schema.json" with { type: "json" };
```

JSON modules require an import attribute in Node.js (`with { type: "json" }`). The package manifest is exported as
`innenu-generator/package.json` for tools that need to read the version, and requires the same import attribute:

```ts
import pkg from "innenu-generator/package.json" with { type: "json" };
```

## Development

```bash
pnpm install
pnpm run build        # build with tsdown
pnpm run test         # run the vitest suite
pnpm run lint         # lint and format with oxlint + oxfmt
pnpm run lint:check   # check lint and formatting
pnpm run schema       # regenerate the JSON schemas into schemas/
```

## License

Released under the [Mr.Hope License](./LICENSE).
