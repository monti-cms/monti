import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		// 패키지(`packages/*`)를 한 번에 돌린다. 패키지는 자기 설정 파일을 쓴다.
		projects: [
			"packages/*",
			// 재발 방지(M10-1): 예시 블로그와 다른 사이트 설정으로 본체·관리자·AI 테스트를 다시 돈다.
			"packages/*/vitest.othersite.config.ts",
		],
		testTimeout: 60000,
		hookTimeout: 60000,
		env: {
			...loadEnv(mode, process.cwd(), ""),
			// 운영(Vercel)은 UTC로 돈다. 테스트를 로컬 시간대에 두면 표시 날짜처럼
			// 타임존에 민감한 로직의 회귀를 개발자 환경에서만 못 잡는다.
			TZ: "UTC",
		},
	},
}));
