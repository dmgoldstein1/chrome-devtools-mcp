#!/usr/bin/env bash
# Wrapper script that runs the Chrome DevTools MCP server with a descriptive process name
# and hardened N|Solid security flags (without frozen-intrinsics which conflicts with core-js).
# Note: Filesystem permissions are relaxed to allow reading system packages and node_modules.

exec -a chrome-devtools-mcp /usr/local/bin/nsolid \
  --disable-proto=throw \
  --no-addons \
  --jitless \
  --disallow-code-generation-from-strings \
  --experimental-permission \
  --allow-fs-read="/" \
  --allow-fs-write="/tmp" \
  build/src/index.js
