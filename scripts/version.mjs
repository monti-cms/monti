#!/usr/bin/env node
/**
 * 모든 패키지(`packages/*`)의 버전을 한 번에 바꾼다. 패키지는 늘 같은 버전으로 나간다.
 *
 *   node scripts/version.mjs 0.1.0
 *
 * 바꾼 뒤 커밋하고 `v0.1.0` 태그를 올리면 배포 워크플로(`.github/workflows/release.yml`)가 배포 묶음을 만든다.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
	console.error("Usage: node scripts/version.mjs <version>  (e.g. 0.1.0)");
	process.exit(1);
}

for (const entry of readdirSync(path.join(root, "packages"), { withFileTypes: true })) {
	if (!entry.isDirectory()) continue;
	const file = path.join(root, "packages", entry.name, "package.json");
	const pkg = JSON.parse(readFileSync(file, "utf8"));
	pkg.version = version;
	writeFileSync(file, `${JSON.stringify(pkg, null, "\t")}\n`);
	console.log(`${pkg.name}@${version}`);
}
