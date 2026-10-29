#!/bin/bash
# Same CodeQL semantic analysis, without the JavaScript Action dependency tree.
# Only the official, digest-pinned bundle is executed; never use a rolling download.
set -euo pipefail
[[ "$RUNNER_OS" == Linux && "$RUNNER_ARCH" == X64 ]]
[[ "$GITHUB_SERVER_URL" == https://github.com ]]
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]]
directory=$(mktemp -d "$RUNNER_TEMP/mms-codeql.XXXXXX")
archive="$directory/codeql.tar.gz"
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
  --connect-timeout 15 --max-time 600 --output "$archive" \
  'https://github.com/github/codeql-action/releases/download/codeql-bundle-v2.27.3/codeql-bundle-linux64.tar.gz'
printf '%s  %s\n' '64518dc413c8e7b5733fee2489e830a899bb1e3f28c8873b5869d5cc90164c5c' "$archive" | sha256sum --check --status
tar -xzf "$archive" -C "$directory" --no-same-owner
cli="$directory/codeql/codeql"
[[ "$("$cli" version --format=terse)" == 2.27.3 ]]
"$cli" database create "$directory/database" --language=javascript-typescript \
  --source-root="$GITHUB_WORKSPACE" --threads=2 --ram=4096
"$cli" database analyze "$directory/database" \
  'codeql/javascript-queries:codeql-suites/javascript-security-extended.qls' \
  --format=sarif-latest --output="$directory/results.sarif" --threads=2 --ram=4096 \
  --sarif-category='javascript-security-extended'
printf 'CODEQL_SARIF=%s\nCODEQL_BIN=%s\n' "$directory/results.sarif" "$cli" >> "$GITHUB_ENV"
# Fail on unsuppressed findings, not just on a scanner crash. Upload is a separate always-step.
node scripts/check-sarif.cjs "$directory/results.sarif"
