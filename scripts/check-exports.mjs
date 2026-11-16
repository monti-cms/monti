// Checks each package's `publishConfig.exports` against its `exports`, as the package build does, but with no build: a push finds a stale
// release export (`--write-exports` fixes it) before CI's release proof does. It reads the packages whose build is `build-package.mjs`.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const packages = path.resolve("packages");
const script = path.resolve("scripts/build-package.mjs");
let failed = false;
for (const name of readdirSync(packages)) {
	const dir = path.join(packages, name);
	let pkg;
	try {
		pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
	} catch {
		continue;
	}
	if (!pkg.scripts?.build?.includes("build-package.mjs")) continue;
	try {
		execFileSync(process.execPath, [script, "--check-exports"], { cwd: dir, stdio: "inherit" });
	} catch {
		failed = true;
	}
}
if (failed) process.exit(1);
console.log("check-exports: ok");
