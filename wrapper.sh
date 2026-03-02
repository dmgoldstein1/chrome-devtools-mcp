#!/usr/bin/env bash
# Wrapper script that runs the Chrome DevTools MCP server with a descriptive process name
# and full hardened N|Solid security flags.

exec -a chrome-devtools-mcp /usr/local/bin/nsolid \
  --disable-proto=throw \
  --no-addons \
  --jitless \
  --disallow-code-generation-from-strings \
  --frozen-intrinsics \
  --experimental-permission \
  --allow-fs-read="${ALLOW_FS_READ:-/app}" \
  --allow-fs-write="${ALLOW_FS_WRITE:-/tmp}" \
  build/src/index.js
