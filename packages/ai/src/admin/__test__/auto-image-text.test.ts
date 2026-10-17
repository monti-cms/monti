import type { ImageInsertedEvent } from "@monti-cms/admin";
import type { Site } from "@monti-cms/core/site";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listAiActions = vi.fn();
const runAiAction = vi.fn();
vi.mock("../api", () => ({ listAiActions: (...args: unknown[]) => listAiActions(...args) }));
vi.mock("../ai-slot-provider", () => ({ runAiAction: (...args: unknown[]) => runAiAction(...args) }));

const { aiAdminEvents, autoImageText } = await import("../auto-image-text");

/** An inserted image event of a site whose `ai()` options are `options`, recording what `fill` was given. */
const eventOf = (options: unknown, image: Partial<ImageInsertedEvent["image"]> = {}) => {
	const filled: unknown[] = [];
	const event = {
		image: { mediaId: "m1", alt: "", caption: "", decorative: false, ...image },
		around: "Before\n[image]\nAfter",
		site: { pluginOptions: () => options },
		signal: new AbortController().signal,
		fill: (values: unknown) => {
			filled.push(values);
			return true;
		},
	} as unknown as ImageInsertedEvent;
	return { event, filled };
};

beforeEach(() => {
	listAiActions.mockReset().mockResolvedValue({ usable: ["imageAlt", "imageCaption"], items: [] });
	runAiAction.mockReset().mockImplementation(async (_site: unknown, action: string) => ({
		kind: "candidates",
		items: [
			{ value: `${action} first`, label: "" },
			{ value: `${action} second`, label: "" },
		],
	}));
});

describe("ai({ autoImageText })", () => {
	it("subscribes only when the option is on, so the image dialog keeps asking for alt text otherwise", () => {
		const siteWith = (options: unknown) => ({ pluginOptions: () => options }) as unknown as Site;
		expect(aiAdminEvents(siteWith({})).editor?.imageInserted ?? []).toHaveLength(0);
		expect(aiAdminEvents(siteWith(undefined)).editor?.imageInserted ?? []).toHaveLength(0);
		expect(aiAdminEvents(siteWith({ autoImageText: true })).editor?.imageInserted).toEqual([autoImageText]);
	});

	it("runs imageAlt and imageCaption on the image and fills each field with the first candidate", async () => {
		const { event, filled } = eventOf({ autoImageText: true });
		await autoImageText(event);
		expect(runAiAction).toHaveBeenCalledWith(
			event.site,
			"imageAlt",
			{ image: { mediaId: "m1" }, around: "Before\n[image]\nAfter" },
			{ signal: event.signal },
		);
		expect(filled).toEqual(expect.arrayContaining([{ alt: "imageAlt first" }, { caption: "imageCaption first" }]));
	});

	it("skips a field that already has text, a decorative image's alt, and an action that is not usable", async () => {
		listAiActions.mockResolvedValue({ usable: ["imageAlt"], items: [] });
		const { event, filled } = eventOf({ autoImageText: true }, { decorative: true });
		await autoImageText(event);
		expect(runAiAction).not.toHaveBeenCalled();
		expect(filled).toEqual([]);
	});
});
