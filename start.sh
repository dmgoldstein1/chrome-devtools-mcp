#!/usr/bin/env bash
# Starts Chrome DevTools MCP server under a hardened N|Solid runtime with security hardening.

set -euo pipefail

# Configuration from environment variables with secure defaults
export ALLOW_FS_READ="${ALLOW_FS_READ:-/app}"
export ALLOW_FS_WRITE="${ALLOW_FS_WRITE:-/tmp}"

echo "[mcp-server] launching nsolid with hardened flags for Chrome DevTools MCP"

# exec replaces this shell with wrapper so nsolid becomes PID 1 and signals work correctly
exec /usr/local/bin/wrapper.sh
