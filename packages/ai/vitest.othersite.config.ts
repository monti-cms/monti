import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * 재발 방지(M10-1): 블로그와 컬렉션·필드·언어·블록이 다른 설정(`test/other-site.config.ts`, AI 기능도 그 사이트의 필드 이름에
 * 붙는다)으로 AI 플러그인 테스트를 다시 돈다. 새 테스트는 저절로 이 묶음에도 들어간다. 기능·필드는 설정에서 찾는다
 * (예: `src/__test__/any-site.test.ts`). 블로그 예시 설정의 기능 이름(slug·summary·tags…)·컬렉션·블록·한국어 원문을 그대로
 * 쓰는 테스트만 아래에서 뺀다.
 */
const BLOG_FIXTURE_TESTS = [
	// 블로그 설정의 기능 키(slug·summary·tags·category·codeFold…)와 문체 가이드 공통 문구를 그대로 쓴다.
	"src/__test__/action.test.ts",
	"src/__test__/plugin.test.ts",
	"src/__test__/run-route.test.ts",
	"src/__test__/run.test.ts",
	"src/__test__/settings.test.ts",
	"src/__test__/shared-route.test.ts",
	"src/__test__/shared.test.ts",
	"src/__test__/store.test.ts",
	// 블로그 블록(콜아웃·Mermaid 등)과 한국어 원문·여러 언어를 쓴다.
	"src/__test__/custom.test.ts",
	"src/admin/__test__/ai-test-sample.test.tsx",
	"src/admin/__test__/ai-translate.test.ts",
];

export default defineConfig(({ mode }) => ({
	test: {
		name: "ai (other-site)",
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: BLOG_FIXTURE_TESTS,
		setupFiles: ["../admin/src/test/setup-dom.ts"],
		sequence: { groupOrder: 3 },
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			...loadEnv(mode, path.resolve(__dirname, "../.."), ""),
			...loadEnv(mode, __dirname, ""),
			TZ: "UTC",
		},
	},
	resolve: {
		alias: {
			"@cms-config": path.resolve(__dirname, "./test/other-site.config.ts"),
			"@cms-server": path.resolve(__dirname, "../core/test/cms.server.ts"),
			"server-only": path.resolve(__dirname, "../core/test/server-only.ts"),
		},
	},
}));
