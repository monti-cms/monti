import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		name: "ai",
		// 서버 쪽 테스트는 node에서 돈다. 관리자 화면 테스트는 파일 머리의 `@vitest-environment jsdom`으로 바꾼다.
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		setupFiles: ["../admin/src/test/setup-dom.ts"],
		// 저장소 루트에서 함께 돌 때는 다른 묶음 뒤에 돈다(`vitest.config.ts`).
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
			// AI 플러그인 테스트는 예시 블로그 설정에 AI 플러그인을 더한 설정으로 돈다.
			"@cms-config": path.resolve(__dirname, "./test/cms.config.ts"),
			"@cms-server": path.resolve(__dirname, "../core/test/cms.server.ts"),
			"server-only": path.resolve(__dirname, "../core/test/server-only.ts"),
		},
	},
}));
