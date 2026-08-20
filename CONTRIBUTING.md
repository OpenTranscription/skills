# Contributing

Thanks for looking. Issues and pull requests are welcome.

## Development

```
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run typegen    # regenerate types from the live spec
```

Husky runs the same gate the product repo does: `lint-staged` on commit (eslint
`--fix` then prettier, on staged files only), commitlint on the message, and
typecheck plus lint plus the full suite on push. CI runs the identical steps, so
a green pre-push means a green build.

### The TypeScript version is pinned by two ceilings

`typescript-eslint` caps its TypeScript peer at `>=4.8.4 <6.1.0`, and TS 7 makes
`eslint .` throw outright, so 6.0.3 is the newest compiler this repo can use. `openapi-typescript` caps its peer at `^5.x`, which
`package.json` overrides to the root TypeScript.

That override is not a guess. `npm run typegen` under TS 6 regenerates
`packages/sdk/src/generated/api.ts` byte-identically, which the `spec-drift` CI job
checks on every run and nightly, so a real incompatibility would fail a build
within a day. The peer cap reflects an author being conservative about a major
version they have not tested. It is not evidence of a real break.

One npm quirk to know: after changing the override, `npm install` had to run twice
before it wrote a lockfile `npm ci` would accept (the first pass dropped
`conventional-commits-filter`). If CI fails on a missing package that is plainly
present, run `npm install` again and commit the lockfile.

## Releasing

Merging to `main` releases. [semantic-release](https://semantic-release.gitbook.io)
reads the commit messages, picks the next version, tags, cuts a GitHub release
with the notes, and publishes both packages to npm. Nobody edits a version
number by hand.

**The changelog is the [Releases page](https://github.com/OpenTranscription/skills/releases),
not a file in the repo.** A committed `CHANGELOG.md` would only restate what the
tag and the release notes already say. It would not cost an extra commit, though:
`@semantic-release/git` already pushes `chore(release): <version> [skip ci]` on
every release to carry the stamped `package.json` files, so `main` gains one
commit per release whether a changelog exists or not.

Which means the commit message _is_ the release decision:

| Commit type                                           | Effect     |
| ----------------------------------------------------- | ---------- |
| `feat:`                                               | minor bump |
| `fix:`, `perf:`, `refactor:`, `revert:`               | patch bump |
| `docs:`, `style:`, `test:`, `build:`, `ci:`, `chore:` | no release |
| any type with `BREAKING CHANGE:` in the body          | major bump |

commitlint enforces the format twice: a husky `commit-msg` hook locally, and a
CI job over every commit in a pull request, because the hook is skippable and a
malformed type fails silently: it cuts no release at all instead of erroring.

Both packages share one version and are always published together. `ot` pins
`@opentranscription/sdk` to an exact version, and `scripts/setVersion.mjs` keeps
that pin in step with the bump; a stale pin would ship a CLI wired to the
previous SDK, which the workspace symlink hides from every local test.

Publishing uses npm **trusted publishing**, so there is no `NPM_TOKEN` and no
secret of any kind. `release.yml` requests an OIDC token from GitHub, and npm
exchanges it for publish rights scoped to this repository and that one workflow
file. Nothing long-lived exists to leak, rotate, or forget to renew.

Setting it up is per package and one-time. On npmjs.com, under
**Packages → @opentranscription/sdk → Settings → Trusted publishing** (and the
same for `cli`), add a GitHub Actions publisher pointing at
`OpenTranscription/skills` with workflow `release.yml`. The filename must match
exactly, extension included. The package has to exist on the registry before it
has a settings page, so the first version of a brand-new package is published by
hand.

Provenance attestations come free with trusted publishing on a public repository,
so every release since 0.1.1 carries a SLSA statement linking the tarball to the
commit and workflow run that built it. Verify one with
`npm view @opentranscription/cli dist.attestations`.
