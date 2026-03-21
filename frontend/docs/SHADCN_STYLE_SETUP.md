# shadcn-style layout in this repo

This project uses **Vite + React + TypeScript + Tailwind CSS v4**. It is **not** initialized with `npx shadcn@latest init`, but follows the same conventions:

| Item | Location |
|------|----------|
| Path alias `@/` | → `src/` (`vite.config.ts` + `tsconfig.app.json`) |
| `cn()` utility | `src/lib/utils.ts` (clsx + tailwind-merge) |
| UI primitives | `src/components/ui/` |

## Why `components/ui/`?

shadcn registers generated primitives under **`src/components/ui`**. Keeping that folder:

- Matches official docs and copy-paste snippets (`@/components/ui/...`)
- Separates **design-system** pieces from **feature** components in `src/components/`

## Optional: full shadcn CLI

From `frontend/`:

```bash
npx shadcn@latest init
```

Choose TypeScript, Tailwind, `@/` alias. Then add components with:

```bash
npx shadcn@latest add button card input
```

Existing Tailwind v4 + Vite setup may require [shadcn Tailwind v4 notes](https://ui.shadcn.com/docs/installation/vite) if the CLI prompts differ.

## Dependencies

- `lucide-react` — icons (already installed)
- `clsx` + `tailwind-merge` — `cn()` (already installed)
