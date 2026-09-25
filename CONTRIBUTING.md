# Contributing to LazyZCode

Thank you for improving LazyZCode. Keep changes focused, preserve the package
boundary, and avoid adding host configuration, credentials, or generated local
state to commits.

## Before opening an issue

Search existing issues first. For a bug report, include the LazyZCode version,
host version, operating system, exact reproduction steps, and sanitized output
from the verification command. Do not paste tokens, credentials, or private
workspace paths.

## Pull requests

Create one focused branch and describe the user-visible change, compatibility
impact, and verification in the pull request template. Keep pull requests
small and update documentation or `plugins/lazyzcode/CHANGELOG.md` when public
behavior changes.

Run these checks from `plugins/lazyzcode/` before requesting review:

```bash
bash scripts/lazyzcode-load-check.sh
bash scripts/lazyzcode-verify.sh            # suites: LAZYZCODE_VERIFY_SUITE=core|all|lifecycle|language (default all)
bash tests/publication-regression.sh
node scripts/check-product-naming.js       # run from the repository root
```

`scripts/lazyzcode-verify.sh` runs Node tests with conservative concurrency:
set `LAZYZCODE_NODE_TEST_CONCURRENCY` to an integer from 1 through 4 (default 2).
The CI workflow runs the same release-relevant checks on every pull request.

## Releases

Use a version tag in the form `vX.Y.Z` only after the default-branch CI is
green and the changelog documents the user-facing change. Bump the
`version` in `plugins/lazyzcode/.zcode-plugin/plugin.json` and the matching
`plugins/marketplace.json` entry together so ZCode's update detection offers
the new release. The tag-release workflow creates GitHub release notes from
merged pull requests and labels. Review the generated notes before publishing
a prerelease or major release.
