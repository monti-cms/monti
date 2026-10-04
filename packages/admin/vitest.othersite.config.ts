import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * 재발 방지(M10-1): 블로그와 컬렉션·필드·언어·블록이 다른 설정(`../core/test/other-site.config.ts`)으로 관리자 화면 테스트를
 * 다시 돈다. 새 테스트는 저절로 이 묶음에도 들어간다. 컬렉션·필드·블록은 설정에서 찾는다
 * (예: `src/screens/__test__/any-site-screens.test.tsx`, `src/editor/__test__/any-site-blocks.test.ts`).
 * 블로그 예시 설정의 컬렉션·필드·블록·언어(post·tag·summary·callout·ko/ja…)를 그대로 쓰는 테스트만 아래에서 뺀다.
 */
const BLOG_FIXTURE_TESTS = [
	// 블로그 컬렉션·필드(post·memo·category·tag·collection·summary)와 한국어·일본어 번역본으로 화면을 그린다.
	"src/screens/__test__/admin-dashboard.test.tsx",
	"src/screens/__test__/admin-entries-table.test.tsx",
	"src/screens/__test__/blog-list-defaults.test.ts",
	"src/screens/__test__/list-row-menu.test.ts",
	"src/screens/__test__/list-state.test.ts",
	"src/screens/__test__/record-panel.test.tsx",
	"src/screens/entries/__test__/backlink-input.test.tsx",
	"src/screens/entries/__test__/bulk-bar.test.tsx",
	"src/screens/entries/__test__/custom-field-input.test.tsx",
	"src/screens/entries/__test__/entry-editor-shell.test.tsx",
	"src/screens/entries/__test__/entry-form.test.ts",
	"src/editor/__test__/m13-accessibility.test.tsx",
	"src/editor/internal-link.test.ts",
	// 블로그 블록(콜아웃·접기·탭·단·Mermaid)과 예시 사용자 블록(notice·embed)으로 편집기를 시험한다.
	"src/editor/__test__/converters.test.ts",
	"src/editor/__test__/custom-block-menu.test.tsx",
	"src/editor/__test__/slash-and-tooltip.test.ts",
	"src/editor/__test__/tiptap-content.test.ts",
	"src/editor/drag/__test__/block-refine.test.ts",
	"src/editor/drag/__test__/drag-commands.test.ts",
	"src/editor/blocks/added/__test__/containers.test.ts",
	"src/editor/blocks/added/__test__/custom-block-view.test.tsx",
	"src/editor/blocks/added/__test__/custom-blocks.test.ts",
	// 본문–코드 잇기는 코드 줄을 가리키는 글자 꾸밈(블록 확장의 코드 연결)이 있어야 한다. 없을 때는 `code-link-absent.test.ts`.
	"src/editor/code-block/__test__/code-link.test.ts",
];

export default defineConfig(({ mode }) => ({
	test: {
		name: "admin (other-site)",
		environment: "jsdom",
		globals: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: BLOG_FIXTURE_TESTS,
		setupFiles: ["./src/test/setup-dom.ts"],
		sequence: { groupOrder: 2 },
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
			"@cms-config": path.resolve(__dirname, "../core/test/other-site.config.ts"),
			"@cms-server": path.resolve(__dirname, "../core/test/cms.server.ts"),
			"server-only": path.resolve(__dirname, "../core/test/server-only.ts"),
		},
	},
}));
