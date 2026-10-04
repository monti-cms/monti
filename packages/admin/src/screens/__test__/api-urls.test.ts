import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGES = path.resolve(__dirname, "../../../..");
/** 서버 경로 정의·설명이라 주소 글자가 남아도 되는 곳. */
const ALLOWED = [/\/core\/src\//, /\/(plugin|server)\.ts$/, /\/bareun\/src\/(route|options|index)\.ts$/];

const sources = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "__test__" ? [] : sources(full);
		return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
	});

describe("관리자 API 주소(basePath)", () => {
	it("관리자·확장 화면 코드는 /api/cms 주소를 직접 쓰지 않고 cmsApiUrl()로 만든다", () => {
		const offenders = readdirSync(PACKAGES)
			.flatMap((name) => sources(path.join(PACKAGES, name, "src")))
			.filter((file) => !ALLOWED.some((pattern) => pattern.test(file)))
			.filter((file) => /["'`]\/api\/cms/.test(readFileSync(file, "utf8")))
			.map((file) => path.relative(PACKAGES, file));
		expect(offenders).toEqual([]);
	});
});
