import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		name: "blocks",
		environment: "jsdom",
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
			// 블록 확장 테스트는 본체 패키지의 예시 설정(이 패키지의 블록을 모두 쓴다)으로 돈다.
			"@cms-config": path.resolve(__dirname, "../core/test/cms.config.ts"),
			"@cms-server": path.resolve(__dirname, "../core/test/cms.server.ts"),
			"server-only": path.resolve(__dirname, "../core/test/server-only.ts"),
		},
	},
}));
