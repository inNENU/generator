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

Page generators take a `PageConfig` object as their first argument. The page path is a separate argument for `getPageJSON(page, pagePath,
diffFiles?, options?)` and `getPageText(page, pagePath, options?)`, while `getPageMarkdown(page, options?)` reads it from
`options.location` because the Markdown options object already carries the rendering context.

`config()` accepts:

| Option       | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| `assets`     | Public assets base URL, used by `$` file aliases and icon links |
| `icon`       | Icon base directory                                             |
| `mapFolder`  | Directory containing map pages and marker data                  |
| `mapKey`     | Tencent map key                                                 |
| `pageFolder` | Directory containing page YAML files                            |

## Time formatting

Page `time` values are rendered in `Asia/Shanghai` (UTC+8) regardless of the build machine's time zone. ISO datetimes are converted to
Beijing wall-clock time, and datetimes without an explicit offset are interpreted as Beijing time, so the same source always produces
the same output. Date-only values (`YYYY-MM-DD`) keep their date without a time component and are not shifted across days.

## Markdown output

Markdown generation targets the VuePress site only. The WeChat miniapp and the native App consume the JSON artifacts, so there is no
Markdown rendering requirement for them; the `env` field is therefore respected only for `"web"` in the Markdown pipeline (components
marked for other environments are skipped there by design). Use `getPageJSON` for Mini Program / App content.

Link destinations are validated before rendering. Relative paths and anchors, `http:`, `https:`, `mailto:` and telephone `tel:` URLs
are allowed; other schemes such as `javascript:` or `data:` are dropped, or rendered as non-clickable text when the surrounding
component still needs to show its label.

## Entry points

- `innenu-generator`: full public API (page, component, schema, helpers, generators).
- `innenu-generator/schema`: zod schemas and validators for page components (`textComponentSchema`, `checkText`, ...). This subpath does
  not include the page config schema.
- `innenu-generator/typings`: type-only subpath with the shared TypeScript types.

### JSON Schema files

The draft-07 JSON Schema files in `schemas/` are generated during release (`prepublishOnly`) and shipped inside the package, so consumers
never need to run a generator. They are exposed through the `innenu-generator/schemas/*` export:

```ts
import pageConfigSchema from "innenu-generator/schemas/page-config.schema.json" with { type: "json" };
```

JSON modules require an import attribute in Node.js (`with { type: "json" }`). When importing them from TypeScript, enable
`resolveJsonModule` in your `tsconfig.json` and keep `module` on `nodenext` (or `esnext`) so the import attribute is preserved. The
package manifest is exported as `innenu-generator/package.json` for tools that need to read the version, and requires the same import
attribute:

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
