import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { missingOptionalPeers, withCms } from "../with-cms";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

const app = (files: Record<string, object>) => {
	const dir = mkdtempSync(path.join(tmpdir(), "cms-with-"));
	dirs.push(dir);
	for (const [file, json] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), JSON.stringify(json));
	}
	return dir;
};

describe("withCms: 설치하지 않은 선택 의존성", () => {
	it("CMS 패키지의 선택 peer 중 찾을 수 없는 것만 고른다", () => {
		const dir = app({
			"package.json": { dependencies: { "@monti-cms/blocks": "x", "other-lib": "x" } },
			"node_modules/@monti-cms/blocks/package.json": {
				cmsPlugin: true,
				peerDependenciesMeta: { mermaid: { optional: true }, recharts: { optional: true }, react: {} },
			},
			"node_modules/recharts/package.json": {},
			// CMS 패키지가 아닌 라이브러리의 선택 의존성은 건드리지 않는다.
			"node_modules/other-lib/package.json": { peerDependenciesMeta: { nodemailer: { optional: true } } },
		});
		expect(missingOptionalPeers(dir)).toEqual(["mermaid"]);
	});

	it("플러그인 패키지는 이름이 아니라 `cmsPlugin` 표시로 찾는다", () => {
		const dir = app({
			"package.json": {
				dependencies: { "acme-cms-chart": "x", "@monti-cms/core-lookalike": "x", "@monti-cms/admin": "x" },
			},
			"node_modules/acme-cms-chart/package.json": {
				cmsPlugin: true,
				peerDependenciesMeta: { d3: { optional: true } },
			},
			// 이름이 비슷해도 표시가 없으면 플러그인이 아니다.
			"node_modules/@monti-cms/core-lookalike/package.json": {
				peerDependenciesMeta: { nodemailer: { optional: true } },
			},
			// 본체·관리자 패키지는 표시 없이도 본다.
			"node_modules/@monti-cms/admin/package.json": { peerDependenciesMeta: { sonner: { optional: true } } },
		});
		expect(missingOptionalPeers(dir)).toEqual(["d3", "sonner"]);
	});

	it("package.json이 없거나 CMS 패키지가 없으면 빈 목록", () => {
		expect(missingOptionalPeers(app({}))).toEqual([]);
		expect(missingOptionalPeers(app({ "package.json": { dependencies: { "@monti-cms/core": "x" } } }))).toEqual([]);
	});

	it("Turbopack root 밖에 설치된 것은 없는 것으로 본다", () => {
		const outer = app({ "node_modules/mermaid/package.json": {} });
		const root = path.join(outer, "site");
		mkdirSync(path.join(root, "node_modules/@monti-cms/blocks"), { recursive: true });
		writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { "@monti-cms/blocks": "x" } }));
		writeFileSync(
			path.join(root, "node_modules/@monti-cms/blocks/package.json"),
			JSON.stringify({ cmsPlugin: true, peerDependenciesMeta: { mermaid: { optional: true } } }),
		);
		expect(missingOptionalPeers(root)).toEqual([]);
		expect(missingOptionalPeers(root, realpathSync(root))).toEqual(["mermaid"]);
	});
});

describe("withCms: basePath", () => {
	const options = { config: "./cms.config.ts", server: "./cms.server.ts" };

	it("Next basePath를 서버·브라우저 번들 환경 변수로 알린다", () => {
		expect(withCms({ basePath: "/blog" }, options).env?.NEXT_PUBLIC_CMS_BASE_PATH).toBe("/blog");
		expect(withCms({ basePath: "/blog/" }, options).env?.NEXT_PUBLIC_CMS_BASE_PATH).toBe("/blog");
	});

	it("basePath가 없으면 빈 값이고 앱의 다른 env는 그대로 둔다", () => {
		const config = withCms({ env: { KEEP: "1" } }, options);
		expect(config.env).toEqual({ KEEP: "1", NEXT_PUBLIC_CMS_BASE_PATH: "" });
	});
});
