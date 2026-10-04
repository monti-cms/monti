#!/usr/bin/env node
// `monti` command line (init, migrate). It must read the app's TypeScript config files (cms.config.ts, cms.server.ts) and, inside the repo, this package's
// sources too, so it registers tsx first and then loads the command code (`@monti-cms/core/cli`).
// (Same as `--import tsx`: both ES modules and CommonJS. A .ts file in an app without `"type": "module"` is read as CommonJS.)
import "tsx";

const { runCli } = await import("@monti-cms/core/cli");
process.exitCode = await runCli(process.argv.slice(2));
