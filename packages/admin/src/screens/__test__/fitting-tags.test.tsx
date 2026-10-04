import { createTranslator } from "@monti-cms/core/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FittingTags } from "../shared/fitting-tags";
import { sharedMessages } from "../shared/messages";

const t = createTranslator(sharedMessages);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const tags = [
	{ id: "a", title: "React" },
	{ id: "b", title: "Next.js" },
	{ id: "c", title: "SEO" },
];

/** jsdom은 배치를 하지 않으므로 칸 폭과 태그 폭(각 40px, `+N` 16px)을 정해 준다. */
function stubWidths(boxWidth: number) {
	vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
		return this.hasAttribute("title") ? boxWidth : 0;
	});
	vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
		return this.textContent?.startsWith("+") ? 16 : 40;
	});
}

describe("FittingTags", () => {
	it("shows every tag when the column is wide enough", () => {
		stubWidths(200);
		render(<FittingTags tags={tags} />);
		expect(screen.queryByText(new RegExp(t("tags.more", { count: "\\d" })))).toBeNull();
	});

	it("keeps what fits and folds the rest into +N", () => {
		// 40 + 4 + 40 + 4 + 16 = 104 ≤ 110 → 두 개 + `+1`.
		stubWidths(110);
		render(<FittingTags tags={tags} />);
		expect(screen.getByText(t("tags.more", { count: 1 }))).toBeTruthy();
	});

	it("always keeps at least one tag", () => {
		stubWidths(30);
		render(<FittingTags tags={tags} />);
		expect(screen.getByText(t("tags.more", { count: 2 }))).toBeTruthy();
	});
});
