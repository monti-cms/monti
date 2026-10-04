#!/usr/bin/env node
/**
 * 예시 앱 묶음 검사(M12-2). 저장소 패키지(`packages/*`)를 빌드해 묶고, 예시 앱(`examples/other-site`)을 저장소 밖 임시 폴더에
 * 복사해 그 묶음으로 설치한 뒤 타입 검사(`skipLibCheck: false`)와 `next build`를 돈다. 확장을 모두 넣은 설정으로 한 번 더 돈다.
 * 저장소 안에서는 소스를 바로 쓰므로 묶음(`dist`·`exports`·의존성 선언)에서만 깨지는 것을 여기서 잡는다.
 *
 *   node scripts/check-example.mjs            # 빌드부터
 *   node scripts/check-example.mjs --no-build # 이미 빌드한 dist로
 *   node scripts/check-example.mjs --keep     # 끝나고 임시 폴더를 남긴다
 *
 * DB·로그인 연결은 쓰지 않는다(빌드는 연결 없이 된다).
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const run = (cmd, cmdArgs, cwd, env = {}) => {
	console.log(`\n$ (${path.relative(root, cwd) || "."}) ${cmd} ${cmdArgs.join(" ")}`);
	execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
};

// 1. 패키지 목록은 packages/* 에서 뽑는다(새 패키지가 저절로 들어간다).
const packages = readdirSync(path.join(root, "packages"), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => {
		const dir = path.join(root, "packages", entry.name);
		try {
			return { dir, name: JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).name };
		} catch {
			return null;
		}
	})
	.filter(Boolean);
console.log(`packages: ${packages.map((pkg) => pkg.name).join(", ")}`);

// 2. 빌드(의존 순서대로)와 묶기.
if (!args.has("--no-build")) run("pnpm", ["--filter", "./packages/*", "-r", "run", "build"], root);
const work = mkdtempSync(path.join(tmpdir(), "cms-example-check-"));
const vendor = path.join(work, "vendor");
for (const pkg of packages) run("pnpm", ["pack", "--pack-destination", vendor], pkg.dir);
const tarballs = Object.fromEntries(
	packages.map((pkg) => {
		const file = readdirSync(vendor).find((name) => name.startsWith(`${pkg.name.replace("@", "").replace("/", "-")}-`));
		if (!file) throw new Error(`no tarball for ${pkg.name}`);
		return [pkg.name, `file:${path.join(vendor, file)}`];
	}),
);

// 3. 예시 앱을 저장소 밖으로 복사하고 모든 패키지를 묶음으로 잇는다.
const app = path.join(work, "app");
const source = path.join(root, "examples/other-site");
const skip = new Set(["node_modules", ".next", "vendor", "pnpm-lock.yaml", "next-env.d.ts", "tsconfig.tsbuildinfo"]);
cpSync(source, app, { recursive: true, filter: (from) => !skip.has(path.basename(from)) || from === source });
const pkgJsonPath = path.join(app, "package.json");
const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
for (const name of Object.keys(pkgJson.dependencies))
	if (name.startsWith("@monti-cms/")) delete pkgJson.dependencies[name];
Object.assign(pkgJson.dependencies, tarballs);
// 묶음끼리 peer로 서로를 찾을 때도 같은 묶음을 쓴다.
pkgJson.pnpm = { overrides: tarballs };
writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, "\t")}\n`);
const tsconfigPath = path.join(app, "tsconfig.json");
const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
tsconfig.compilerOptions.skipLibCheck = false;
writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, "\t")}\n`);
// 저장소 밖이라 저장소의 pnpm 설정을 읽지 않는다. esbuild 설치 스크립트를 허락한다(pnpm 10은 `onlyBuiltDependencies`,
// 11부터는 `allowBuilds`).
writeFileSync(
	path.join(app, "pnpm-workspace.yaml"),
	"packages: []\nonlyBuiltDependencies:\n  - esbuild\nallowBuilds:\n  esbuild: true\n",
);

run("pnpm", ["install", "--no-frozen-lockfile"], app);

// 4. 예시 설정 그대로 → 확장을 모두 넣은 설정.
const configPath = path.join(app, "cms.config.ts");
const exampleConfig = readFileSync(configPath, "utf8");
const allExtensions = exampleConfig
	.replace(
		'import { blocks } from "@monti-cms/blocks";',
		'import { aiPlugin } from "@monti-cms/ai";\nimport { blocks } from "@monti-cms/blocks";\nimport { bareun } from "@monti-cms/bareun";',
	)
	.replace(/plugins: \[[^\n]*\],/, "plugins: [...blocks(), seo(), aiPlugin(), bareun()],");
if (allExtensions === exampleConfig || !allExtensions.includes("aiPlugin()")) {
	throw new Error("check-example: could not rewrite cms.config.ts plugins for the all-extensions run");
}

const check = (label) => {
	console.log(`\n=== ${label} ===`);
	run("pnpm", ["exec", "tsc", "--noEmit", "-p", "."], app);
	rmSync(path.join(app, ".next"), { recursive: true, force: true });
	run("pnpm", ["exec", "next", "build"], app, { NEXT_TELEMETRY_DISABLED: "1" });
};

try {
	check("example config");
	writeFileSync(configPath, allExtensions);
	check("all extensions");
	console.log("\ncheck-example: ok");
} finally {
	if (args.has("--keep")) console.log(`kept: ${work}`);
	else rmSync(work, { recursive: true, force: true });
}
