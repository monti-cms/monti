import { describe, expect, it, vi } from "vitest";

// 필드 `tab`과 배치 묶음 `tab`이 섞인 사이트. 확장이 준 필드 묶음(`tab` 있음)이 배치 없이 제 탭에 모이는지 본다.
vi.mock("@cms-config", async () => {
	const { defineCollection, defineConfig, fields } = await import("@monti-cms/core");
	const page = defineCollection({
		label: "Page",
		kind: "document",
		fields: {
			title: fields.text({ label: "Title" }),
			slug: fields.slug({ label: "Slug", from: "title" }),
			intro: fields.text({ label: "Intro" }),
			hero: fields.media({ label: "Hero", tab: "Media" }),
			// 배치 묶음의 `tab`이 필드 `tab`보다 먼저다.
			alt: fields.text({ label: "Alt", tab: "Media" }),
			metaTitle: fields.text({ label: "Meta title", tab: "Search" }),
			preview: fields.view({ view: "search", tab: "Search" }),
			note: fields.text({ label: "Note" }),
		},
		layout: [{ fields: ["title", "slug", "intro", "hero"] }, { group: "Accessibility", tab: "Extra", fields: ["alt"] }],
		list: { columns: ["title"] },
	});
	// 배치(`layout`)를 적지 않은 컬렉션. 필드 선언 순서대로 한 묶음이고, 제 `tab`을 가진 필드는 그 탭에 모인다.
	const plain = defineCollection({
		label: "Plain",
		kind: "item",
		fields: {
			title: fields.text({ label: "Title" }),
			metaTitle: fields.text({ label: "Meta title", tab: "Search" }),
			slug: fields.slug({ label: "Slug", from: "title" }),
			note: fields.text({ label: "Note" }),
		},
	});
	return {
		default: defineConfig({
			collections: { page, plain },
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		}),
	};
});

const { DEFAULT_TAB, layoutGroupsOf, tabOf, tabsOf } = await import("../layout-groups");
// 이 파일의 컬렉션은 위에서 바꾼 설정에만 있다.
const page = "page" as Parameters<typeof layoutGroupsOf>[0];

describe("속성 칸 묶음과 탭(배치 `tab` 또는 필드 `tab`)", () => {
	it("필드 `tab`이 있는 필드는 배치에 있든 없든 그 탭의 묶음으로 모은다. 배치 묶음의 `tab`이 먼저다", () => {
		expect(layoutGroupsOf(page)).toEqual([
			{ fields: ["title", "slug", "intro"] },
			{ group: "Accessibility", tab: "Extra", fields: ["alt"] },
			{ fields: ["note"] },
			{ group: "Media", tab: "Media", fields: ["hero"] },
			{ group: "Search", tab: "Search", fields: ["metaTitle", "preview"] },
		]);
	});

	it("배치가 없으면 필드 선언 순서대로 한 묶음이고, 필드 `tab`은 그 탭에 모인다", () => {
		const plain = "plain" as Parameters<typeof layoutGroupsOf>[0];
		expect(layoutGroupsOf(plain)).toEqual([
			{ fields: ["title", "slug", "note"] },
			{ group: "Search", tab: "Search", fields: ["metaTitle"] },
		]);
		expect(tabsOf(plain)).toEqual([DEFAULT_TAB, "Search"]);
	});

	it("탭은 기본 탭 먼저, 나머지는 처음 나온 순서다. 필드가 든 탭을 찾는다", () => {
		expect(tabsOf(page)).toEqual([DEFAULT_TAB, "Extra", "Media", "Search"]);
		expect(tabOf(page, "hero")).toBe("Media");
		expect(tabOf(page, "alt")).toBe("Extra");
		expect(tabOf(page, "metaTitle")).toBe("Search");
		expect(tabOf(page, "note")).toBe(DEFAULT_TAB);
		expect(tabOf(page, "title")).toBe(DEFAULT_TAB);
	});
});
