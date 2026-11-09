# innenu-generator

Content generator for [inNENU](https://github.com/inNENU), producing the data consumed by the WeChat miniapp and the VuePress site from the repository's YAML/Markdown sources.

## Requirements

- Node.js `>=22.12.0` (supported LTS lines)
- pnpm `12.18.0` (declared through `devEngines`)

## Installation

```bash
pnpm add innenu-generator
```

## Usage

Configure the generator once at startup, then call the generators for the content you need:

```ts
import { config, getPageJSON, getPageMarkdown, getPageText } from "innenu-generator";

config({
  assets: "https://assets.innenu.com",
  icon: "https://res.innenu.com/icons",
  mapFolder: "./data/function/map",
  mapKey: "<your map key>",
  pageFolder: "./pages",
});

const pageJSON = getPageJSON({ title: "Home", content: [...] }, "home", [], { check: true });
const pageMarkdown = getPageMarkdown("home", { mode: "web" });
```

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

Link destinations are validated before rendering. Relative paths and anchors, `http:`, `https:`, `mailto:` and telephone `tel:` URLs
are allowed; other schemes such as `javascript:` or `data:` are dropped, or rendered as non-clickable text when the surrounding
component still needs to show its label.

## Entry points

- `innenu-generator`: full public API (page, component, schema, helpers, generators).
- `innenu-generator/schema`: JSON schemas for the page and component configuration.
- `innenu-generator/typings`: type-only subpath with the shared TypeScript types.

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
