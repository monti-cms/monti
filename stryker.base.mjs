// @ts-check
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 모든 git worktree가 공유하는 `.git/stryker/<packageName>.json` 증분 캐시 경로를 돌려준다.
 * Git 저장소 밖에서는 패키지 내부 `.stryker-incremental.json`으로 폴백한다.
 *
 * @param {string} packageName
 * @returns {string}
 */
function resolveIncrementalFile(packageName) {
	try {
		const raw = execFileSync("git", ["rev-parse", "--git-common-dir"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		if (raw.length > 0) {
			const dir = path.join(path.resolve(process.cwd(), raw), "stryker");
			mkdirSync(dir, { recursive: true });
			return path.join(dir, `${packageName}.json`);
		}
	} catch {
		// Git 명령을 쓸 수 없으면 패키지 내부 캐시 파일로 폴백한다.
	}
	return ".stryker-incremental.json";
}

/**
 * 패키지별 Stryker 증분 돌연변이 테스트 설정을 만든다.
 * 캐시는 모든 git worktree가 공유하는 `.git/stryker/<packageName>.json`에 저장되어,
 * worktree 실행이나 브랜치 전환 뒤에도 안 바뀐 파일·테스트 결과를 그대로 재사용한다.
 *
 * @param {string} packageName
 * @param {import("@stryker-mutator/api/core").PartialStrykerOptions} [overrides]
 * @returns {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export function createStrykerConfig(packageName, overrides = {}) {
	return {
		testRunner: "vitest",
		plugins: ["@stryker-mutator/vitest-runner"],
		mutate: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/__test__/**", "!src/**/types.ts"],
		incremental: true,
		incrementalFile: resolveIncrementalFile(packageName),
		coverageAnalysis: "perTest",
		inPlace: true,
		ignorePatterns: ["/*", "!/src"],
		concurrency: 2,
		timeoutMS: 60_000,
		reporters: ["clear-text", "progress"],
		tempDirName: ".stryker-tmp",
		...overrides,
	};
}
