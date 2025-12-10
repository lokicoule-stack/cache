# API Extractor

Tracks public API changes in [etc/lokiverse-bus.api.md](../etc/lokiverse-bus.api.md).

## Daily Workflow

After modifying exports:

```bash
pnpm build && pnpm build:api
git diff etc/lokiverse-bus.api.md  # Review changes
git add etc/lokiverse-bus.api.md
git commit
```

CI runs `pnpm check:api` to ensure the report is up to date.

## Release Tags

Every export needs a tag:

```typescript
/** @public */
export class MessageBus {}

/** @internal */
export function parseConfig() {}
```

Missing tag → build fails with `ae-missing-release-tag`.

## Common Issues

### Build fails: "API signature changed"

```bash
pnpm build:api  # Regenerate report
git add etc/lokiverse-bus.api.md
```

### Build fails: "ae-missing-release-tag"

Add `@public` to the export:

```typescript
/** @public */
export const myExport = ...
```

### Build fails: "ae-forgotten-export"

Export the type:

```typescript
export type MyType = { ... }
```

## Project Configuration

[api-extractor.json](../api-extractor.json):

- **Entry point**: `dist/index.d.ts`
- **Bundled deps**: `@msgpack/msgpack` (inlined in .d.ts)
- **Report**: `etc/lokiverse-bus.api.md` (tracked)
- **Rollups**: `dist/lokiverse-bus.d.ts` (full), `dist/lokiverse-bus-public.d.ts` (public only)

## Scripts

| Command              | Usage           |
| -------------------- | --------------- |
| `pnpm build:api`     | Local (no fail) |
| `pnpm build:api:prod`| Production mode |
| `pnpm check:api`     | Build + validate|

## Why Track the Report?

PR diffs show API changes:

```diff
- export function redis(config: RedisConfig): Transport
+ export function redis(config?: RedisConfig): Transport
```

Prevents accidental breaking changes.
