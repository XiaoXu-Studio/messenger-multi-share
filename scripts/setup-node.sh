#!/bin/sh
# Linux x64 hosted runner; verify the official archive before extraction.
set -eu
[ "${RUNNER_OS:-}" = Linux ] && [ "${RUNNER_ARCH:-}" = X64 ] || exit 1
: "${RUNNER_TEMP:?}" "${GITHUB_PATH:?}"
version=24.22.1
archive=node-v24.22.1-linux-x64.tar.xz
expected=6c172a9ab6718f7b801fb5a7bd486af2ee5e32758086a04b84fcce2aa77095e6
directory=$(mktemp -d "$RUNNER_TEMP/mms-node.XXXXXX")
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
  --connect-timeout 15 --max-time 180 --output "$directory/$archive" \
  "https://nodejs.org/dist/v$version/$archive"
printf '%s  %s\n' "$expected" "$directory/$archive" | sha256sum --check --status
tar -xJf "$directory/$archive" -C "$directory" --no-same-owner
binary="$directory/node-v$version-linux-x64/bin"
[ "$("$binary/node" --version)" = "v$version" ] || exit 1
printf '%s\n' "$binary" >> "$GITHUB_PATH"
PATH="$binary:$PATH" "$binary/node" scripts/setup-npm.cjs "$directory"
