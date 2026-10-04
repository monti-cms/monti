import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * 재발 방지(M10-1): 블로그와 SEO 필드 이름·탭·언어가 다른 설정(`test/other-site.config.ts`)으로 SEO 확장 테스트를 다시 돈다.
 * 필드는 설정에서 역할로 찾는다. 블로그 예시 설정의 필드 이름을 그대로 쓰는 테스트만 아래에서 뺀다.
 */
const BLOG_FIXTURE_TESTS = ["src/__test__/blog-seo.test.ts"];

export default defineConfig(({ mode }) => ({
	test: {
		name: "seo (other-site)",
		environment: "jsdom",
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
