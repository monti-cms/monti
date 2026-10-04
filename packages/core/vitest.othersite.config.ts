import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * 재발 방지(M10-1): 블로그와 컬렉션·필드·언어·블록이 다른 설정(`test/other-site.config.ts`)으로 본체 테스트를 다시 돈다.
 * 새 테스트는 저절로 이 묶음에도 들어간다. 컬렉션·필드·블록 이름은 설정에서 찾는다(`test/any-site.ts`).
 * 블로그 예시 설정의 값(컬렉션 목록·주소·글 해시 등)을 그대로 확인하는 테스트는 `*.blog.test.ts`에 두고 여기서 뺀다(M12-3).
 */
const BLOG_FIXTURE_TESTS = ["src/**/*.blog.test.ts"];

export default defineConfig(({ mode }) => ({
	test: {
		name: "core (other-site)",
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: BLOG_FIXTURE_TESTS,
		sequence: { groupOrder: 1 },
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
			"@cms-server": path.resolve(__dirname, "./test/cms.server.ts"),
			"server-only": path.resolve(__dirname, "./test/server-only.ts"),
		},
	},
}));
