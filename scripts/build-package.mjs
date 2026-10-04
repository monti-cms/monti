// 패키지 빌드: TypeScript 소스를 `dist`(ESM JS + 타입 선언)로 낸다. 패키지 폴더에서
// `node ../../scripts/build-package.mjs [--write-exports] [복사할 src 아래 폴더…]`.
//
// - 저장소 안에서는 `exports`가 소스(`src/*.ts`)를 가리키고, 배포 묶음(`pnpm pack`)은 `publishConfig.exports`(dist)를 쓴다.
//   `publishConfig.exports`는 `exports`에서 만든다. 다르면 빌드를 멈춘다(`--write-exports`로 고친다).
// - `tsc`를 파일마다 따로 돌려 내므로 "use client" 지시문이 그대로 남는다.
// - 다른 작업 공간 패키지(@monti-cms/*)는 그 패키지의 `dist` 타입 선언을 본다(먼저 빌드해 둔다).
// - 소스는 확장자 없이 import하므로 낸 파일의 상대 경로에 `.js`·`/index.js`를 붙인다.
// - `@cms-config`·`@cms-server`는 그대로 둔다. 앱이 `withCms`·tsconfig `paths`로 자기 설정 파일에 잇는다.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const args = process.argv.slice(2);
const writeExports = args.includes("--write-exports");
const copies = args.filter((arg) => !arg.startsWith("--"));
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const pkg = readJson(path.join(root, "package.json"));

/** 소스 경로(`./src/x.ts`) → 배포 경로. */
const toDist = (target, ext) => target.replace(/^\.\/src\//, "./dist/").replace(/\.tsx?$/, ext);
const publishTarget = (target) => {
	if (typeof target === "string") {
		if (!/\.tsx?$/.test(target)) return target;
		return { types: toDist(target, ".d.ts"), default: toDist(target, ".js") };
	}
	// 조건부 진입점(예: 브라우저용 빈 진입점): 조건마다 JS를, 타입은 기본 조건에서.
	const out = { types: toDist(target.default, ".d.ts") };
	for (const [condition, value] of Object.entries(target)) out[condition] = toDist(value, ".js");
	return out;
};
const publishExports = Object.fromEntries(
	Object.entries(pkg.exports).map(([key, target]) => [key, publishTarget(target)]),
);
const current = JSON.stringify(pkg.publishConfig?.exports ?? null);
if (current !== JSON.stringify(publishExports)) {
	if (!writeExports) {
		console.error(`${pkg.name}: publishConfig.exports is out of date. Run the build with --write-exports.`);
		process.exit(1);
	}
	pkg.publishConfig = { ...pkg.publishConfig, exports: publishExports };
	writeFileSync(path.join(root, "package.json"), `${JSON.stringify(pkg, null, "\t")}\n`);
}

// 작업 공간 의존 패키지의 dist 타입 선언을 `paths`로 잇는다.
const rel = (file) => {
	const relative = path.relative(root, file);
	return relative.startsWith("./") || relative.startsWith("../") ? relative : `./${relative}`;
};
// 앱 설정 자리(`@cms-config`·`@cms-server`)의 타입. 본체는 자기 소스를, 다른 패키지는 본체의 배포 타입을 본다.
const stubs = path.join(root, ".build-stubs");
rmSync(stubs, { recursive: true, force: true });
if (pkg.name !== "@monti-cms/core") {
	mkdirSync(stubs, { recursive: true });
	writeFileSync(
		path.join(stubs, "cms-config.d.ts"),
		'import type { CmsConfig } from "@monti-cms/core";\ndeclare const config: CmsConfig;\nexport default config;\n',
	);
	writeFileSync(
		path.join(stubs, "cms-server.d.ts"),
		'import type { CmsServerConfig } from "@monti-cms/core/server";\ndeclare const config: CmsServerConfig;\nexport default config;\n',
	);
}
const stubDir = pkg.name === "@monti-cms/core" ? path.join(root, "build") : stubs;
const paths = {
	"@cms-config": [rel(path.join(stubDir, "cms-config.d.ts"))],
	"@cms-server": [rel(path.join(stubDir, "cms-server.d.ts"))],
};
const deps = { ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies };
for (const name of Object.keys(deps).filter((dep) => dep.startsWith("@monti-cms/"))) {
	const dir = path.join(root, "..", name.slice("@monti-cms/".length));
	const depPkg = readJson(path.join(dir, "package.json"));
	for (const [key, target] of Object.entries(depPkg.publishConfig?.exports ?? {})) {
		const types = typeof target === "string" ? target : target.types;
		if (!types) continue;
		paths[`${name}${key.slice(1)}`] = [rel(path.join(dir, types))];
	}
}
const generated = path.join(root, "tsconfig.build.generated.json");
writeFileSync(
	generated,
	`${JSON.stringify({ extends: "./tsconfig.build.json", compilerOptions: { paths } }, null, "\t")}\n`,
);

rmSync(dist, { recursive: true, force: true });
try {
	execFileSync("pnpm", ["exec", "tsc", "-p", generated], { stdio: "inherit" });
} finally {
	rmSync(generated, { force: true });
	rmSync(stubs, { recursive: true, force: true });
}

const files = [];
const walk = (dir) => {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) walk(full);
		else if (/\.(js|d\.ts)$/.test(name)) files.push(full);
	}
};
walk(dist);

const SPEC =
	/((?:from|import)\s*\(?\s*|export\s+\*\s+from\s+|export\s+\*\s+as\s+\w+\s+from\s+)(["'])(\.{1,2}\/[^"']+)\2/g;
const resolveSpec = (file, spec) => {
	if (/\.(js|mjs|cjs|json|css)$/.test(spec)) return spec;
	const base = path.resolve(path.dirname(file), spec);
	if (existsSync(`${base}.js`) || existsSync(`${base}.d.ts`)) return `${spec}.js`;
	if (existsSync(path.join(base, "index.js")) || existsSync(path.join(base, "index.d.ts"))) return `${spec}/index.js`;
	return spec;
};
for (const file of files) {
	const source = readFileSync(file, "utf8");
	const out = source.replace(SPEC, (_, head, quote, spec) => `${head}${quote}${resolveSpec(file, spec)}${quote}`);
	if (out !== source) writeFileSync(file, out);
}

for (const folder of copies) cpSync(path.join(root, "src", folder), path.join(dist, folder), { recursive: true });
console.log(`built ${pkg.name}: ${files.length} files`);
