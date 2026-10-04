#!/usr/bin/env node
/**
 * 배포 묶음 폴더를 만든다. 빌드해 둔 패키지를 `pnpm pack`으로 묶고(`publishConfig`·`workspace:*` 버전이 반영된다)
 * 풀어서 `<출력 폴더>/<패키지 폴더 이름>/`에 둔다. 배포 워크플로가 이 폴더를 `release` 브랜치에 올린다.
 *
 *   pnpm build && node scripts/pack-release.mjs <출력 폴더>
 *
 * 공개 전에는 npm 대신 GitHub 주소로 설치한다:
 *   "@monti-cms/core": "github:monti-cms/monti#release/v0.1.0&path:/core"
 */
import { execFileSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] && path.resolve(process.argv[2]);
if (!out) {
	console.error("Usage: node scripts/pack-release.mjs <out-dir>");
	process.exit(1);
}

const packages = readdirSync(path.join(root, "packages"), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => {
		const dir = path.join(root, "packages", entry.name);
		return { dir, folder: entry.name, pkg: JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) };
	});

// 패키지는 늘 같은 버전으로 나간다(`scripts/version.mjs`).
const versions = new Set(packages.map(({ pkg }) => pkg.version));
if (versions.size !== 1) {
	console.error(`Package versions differ: ${[...versions].join(", ")}. Run scripts/version.mjs first.`);
	process.exit(1);
}
const [version] = versions;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const work = mkdtempSync(path.join(tmpdir(), "monti-release-"));
try {
	for (const { dir, folder, pkg } of packages) {
		const before = new Set(readdirSync(work));
		execFileSync("pnpm", ["pack", "--pack-destination", work], { cwd: dir, stdio: "inherit" });
		const tarball = readdirSync(work).find((file) => !before.has(file) && file.endsWith(".tgz"));
		if (!tarball) throw new Error(`${pkg.name}: pnpm pack produced no tarball`);
		const unpacked = path.join(work, folder);
		mkdirSync(unpacked);
		execFileSync("tar", ["-xzf", path.join(work, tarball), "-C", unpacked]);
		// 묶음은 `package/` 아래에 풀린다.
		renameSync(path.join(unpacked, "package"), path.join(out, folder));
		// 라이선스는 저장소 루트에 하나만 둔다. 묶음마다 넣는다.
		copyFileSync(path.join(root, "LICENSE"), path.join(out, folder, "LICENSE"));
		console.log(`${pkg.name}@${version} → ${folder}/`);
	}
} finally {
	rmSync(work, { recursive: true, force: true });
}

copyFileSync(path.join(root, "LICENSE"), path.join(out, "LICENSE"));

const rows = packages.map(
	({ folder, pkg }) =>
		`| \`${pkg.name}\` | \`"${pkg.name}": "github:monti-cms/monti#release/v${version}&path:/${folder}"\` |`,
);
writeFileSync(
	path.join(out, "README.md"),
	`# Monti 배포 묶음 v${version}

이 브랜치는 배포 워크플로가 만든다. 직접 고치지 않는다. 소스는 \`main\` 브랜치에 있다.

pnpm으로 설치한다(\`path:\`는 pnpm만 지원한다).

| 패키지 | package.json |
| --- | --- |
${rows.join("\n")}
`,
);
