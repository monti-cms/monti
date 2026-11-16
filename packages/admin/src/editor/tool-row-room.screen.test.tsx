import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { gapAbove } from "../../../../testing/input";
import { scene } from "../../test/scene";
import * as media from "../screens/entry/media.stories";
import * as blocks from "../screens/entry/site-blocks.stories";

const { ArchivedBlocks, ManyInBody } = composeStories(media);
const SiteBlocksArchived = scene<blocks.Loaded>(
	{ loaders: blocks.site(undefined, { archived: true }) },
	blocks.default,
);
const SiteBlocksWritten = scene<blocks.Loaded>({ loaders: blocks.site() }, blocks.default);

const body = () => page.getByRole("textbox", { name: "본문" });
const block = (type: string) => body().element().querySelector(`[data-block="${type}"]`) as HTMLElement;
/** The plain gap between two blocks of text: what a block that keeps no room for a tool row stands under what is before it. */
const PLAIN = 20;
/** The room a tool row keeps above a block that can have one: its 36px and the 8px under it. */
const ROOM = 44;

describe("the room a block keeps for its tool row", () => {
	it("a read-only body keeps none for any block: a picture, a file and a code block stand the plain gap under what is before them", async () => {
		await ArchivedBlocks.run();
		await expect.element(body().getByRole("img", { name: "아침 책상" })).toBeVisible();
		await expect.poll(() => block("codeBlock")).not.toBeNull();
		for (const type of ["image", "file", "codeBlock"])
			await expect.poll(() => Math.round(gapAbove(block(type)))).toBe(PLAIN);
	});

	it("a read-only body keeps none for a site block either, and a written body keeps it for each kind", async () => {
		await SiteBlocksArchived.run();
		await expect.poll(() => block("callout")).not.toBeNull();
		await expect.poll(() => gapAbove(block("callout"))).toBeLessThan(ROOM - 8);
	});

	it("a written body keeps it above a picture and a file, whether or not a row shows", async () => {
		await ManyInBody.run();
		await expect.element(body().getByRole("img", { name: "아침 책상" })).toBeVisible();
		for (const type of ["image", "file"]) await expect.poll(() => gapAbove(block(type))).toBeGreaterThanOrEqual(ROOM);
	});

	it("a written body keeps it above a site block", async () => {
		await SiteBlocksWritten.run();
		await expect.poll(() => block("callout")).not.toBeNull();
		await expect.poll(() => gapAbove(block("callout"))).toBeGreaterThanOrEqual(ROOM);
	});
});
