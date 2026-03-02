# Chrome DevTools MCP - Hardened N|Solid Runtime

This folder contains Docker configuration to run the Chrome DevTools MCP server within a hardened N|Solid runtime container with security hardening features.

## Features

- **Hardened N|Solid Runtime**: Uses the `nodesource/nsolid:latest` base image with security-focused node flags
- **Permission Model**: `--experimental-permission` enables strict resource access controls
- **Code Generation Prevention**: `--disallow-code-generation-from-strings` blocks dynamic code execution
- **Frozen Intrinsics**: `--frozen-intrinsics` prevents malicious intrinsic modifications
- **JIT Disabled**: `--jitless` runs in interpreter mode for added security
- **Proto Throw**: `--disable-proto=throw` prevents prototype pollution attacks
- **No Addons**: `--no-addons` prevents native module loading

## Files

- **`Dockerfile`**: Builds the hardened container with Node.js dependencies and the MCP server
- **`start.sh`**: Entry point that launches the MCP server with hardened N|Solid flags

## Building

### Option 1: Use Docker Compose (Recommended)

From the workspace root:

```bash
docker-compose build chrome-devtools-mcp
docker-compose up chrome-devtools-mcp
```

### Option 2: Build Standalone

```bash
cd chrome-devtools-mcp
docker build -t chrome-devtools-mcp-hardened .
docker run -it chrome-devtools-mcp-hardened
```

## Configuration

The following environment variables can be set:

- `ALLOW_FS_READ`: File system paths allowed for read access (default: `/app`)
- `ALLOW_FS_WRITE`: File system paths allowed for write access (default: `/tmp`)
- `NODE_ENV`: Set to `production` by default
- `NSOLID_APPNAME`: Application name shown in the N|Solid telemetry console (default: `chrome-devtools-mcp`). Set this to a unique value when running multiple instances so they can be distinguished in the dashboard.
- `NSOLID_COMMAND`: Host and port of the N|Solid console command socket (e.g. `<console-host>:9001`). Required to send telemetry to a remote N|Solid console.

## Security

The hardened runtime prevents the MCP server from:
- Connecting to suspicious IP addresses (with N|Solid monitoring)
- Generating code dynamically from strings
- Modifying JavaScript intrinsics
- Loading native modules
- Using the JIT compiler (interpreter mode only)
