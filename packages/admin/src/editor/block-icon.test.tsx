import { coreBlocks } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { BlockIcon } from "./block-icon";
import { NOT_FROM_MENU } from "./catalog";

describe("BlockIcon", () => {
	it("[every-row-marked] every core block the '/' menu offers, and a template, has its own mark", () => {
		const offered = coreBlocks
			.filter((block) => block.menu && !NOT_FROM_MENU.has(block.type))
			.map((block) => block.type);
		expect(offered).toContain("table");
		const unmarked = [...offered, "template"].filter((type) => BlockIcon({ type }) === null);
		expect(unmarked).toEqual([]);
	});
});
