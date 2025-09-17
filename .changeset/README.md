# Changesets

This directory contains changeset files that track package changes for releases.

## Publishing Process

When publishing packages with workspace protocol dependencies:

1. Run `pnpm changeset version` to update versions
2. Run `pnpm install` to ensure dependencies are resolved
3. Run `pnpm run g:build` to build all packages
4. Run `pnpm changeset publish` to publish

The packages will automatically have their `workspace:*` dependencies replaced with actual versions during publishing.
