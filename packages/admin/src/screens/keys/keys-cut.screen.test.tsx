import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { pointerPath } from "../../../../../testing/input";
import { scene } from "../../../test/scene";
import * as keys from "./keys.stories";

const open = (story: Parameters<typeof scene>[0]) => scene(story, keys.default);
const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
/** The pointer comes along the words' line to a place near their start, as a hand does. */
const pointAt = async (words: Element) => {
	const box = words.getBoundingClientRect();
	await pointerPath(
		[
			{ x: box.left + 70, y: box.top + box.height / 2 },
			{ x: box.left + 10, y: box.top + box.height / 2 },
		],
		{ steps: 5 },
	);
};

// The key rows cut their words to the row (a name, what the key is used for): cut words say themselves whole, as in every list (T181).
describe("the key rows' cut words", () => {
	it("a key's name longer than its row says itself whole when pointed at", async () => {
		await open(keys.LongName).run();
		const name = page.getByRole("table", { name: "AI 키" }).getByText(keys.longName, { exact: true });
		await expect.element(name).toBeVisible();
		const words = name.element() as HTMLElement;
		expect(words.hasAttribute("title")).toBe(false);
		// A smaller window, where the row is shorter than the name.
		const { innerWidth, innerHeight } = window;
		await page.viewport(1024, 768);
		try {
			await expect.poll(() => words.scrollWidth > words.clientWidth).toBe(true);
			await pointAt(words);
			await expect.poll(tip, { timeout: 5000 }).toBe(keys.longName);
		} finally {
			await page.viewport(innerWidth, innerHeight);
		}
	});

	it("a name that fits its row says nothing more", async () => {
		await open(keys.Keys).run();
		const row = page.getByRole("table", { name: "AI 키" }).getByRole("row").first();
		await expect.element(row).toBeVisible();
		const words = row.element().querySelector("[data-cut-words]") as HTMLElement;
		expect(words.scrollWidth).toBeLessThanOrEqual(words.clientWidth);
		await pointAt(words);
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(tip()).toBe(null);
	});

	it("a plugin's key slot is cut the same way: its words are boxes of cut words, whole while they fit", async () => {
		await open(keys.PluginKeys).run();
		const slots = page.getByRole("table", { name: "플러그인 키" });
		await expect.element(slots).toBeVisible();
		const boxes = [...slots.element().querySelectorAll<HTMLElement>("tbody tr [data-cut-words]")];
		// Each row's plugin name and the line under it.
		expect(boxes.length).toBeGreaterThanOrEqual(2);
		for (const box of boxes) expect(getComputedStyle(box).textOverflow).toBe("ellipsis");
	});
});
