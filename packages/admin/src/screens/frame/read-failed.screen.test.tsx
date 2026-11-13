import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import type { Hooks, LogIds } from "../activity/activity.stories";
import * as activity from "../activity/activity.stories";

type Loaded = { site: StorySite; hooks: Hooks; ids: LogIds };
const draw = (story: object) => scene<Loaded>(story, activity.default);
const banners = () => [...document.querySelectorAll("[data-slot=banner]")].map((banner) => banner.textContent);
const failed = () => page.getByRole("note").filter({ hasText: "불러오지 못했습니다" });
const rows = () => page.getByRole("main").getByRole("table").getByRole("row");
const sidebar = () => page.getByRole("navigation").getByRole("button", { name: /^활동 기록/ });

// T154: a screen's read that is refused or gets no answer is said at the screen's top, whichever read it is, with a way to make it again.
describe("a read that does not come back", () => {
	it("[T154] a read that gets no answer after the screen is drawn says so at the top; 'try again' makes it again and the banner goes, the keyboard's focus on to the page", async () => {
		const drawn = draw(activity.Log);
		await drawn.run();
		await expect.element(sidebar()).toHaveTextContent(/^활동 기록1$/);
		expect(banners().some((words) => words?.includes("불러오지 못했습니다"))).toBe(false);
		const { hooks } = drawn.loaded();
		// The sidebar's counts are read again when the person comes back to the window: the network is gone by then.
		hooks.drop.add("frame.counts");
		window.dispatchEvent(new Event("focus"));
		await expect.element(failed()).toBeVisible();
		// At the very top of the screen, over the failed deliveries' banner, and what was read before stays.
		expect(banners()[0]).toContain("불러오지 못했습니다");
		await expect.element(failed()).toHaveTextContent("서버가 답하지 않았습니다");
		await expect.element(sidebar()).toHaveTextContent(/^활동 기록1$/);
		// Still gone: the banner stays, and the press can be made again.
		const again = () => failed().getByRole("button", { name: "다시 시도" });
		await userEvent.click(again());
		await expect.poll(() => hooks.calls.filter((name) => name === "frame.counts").length).toBeGreaterThan(2);
		await expect.element(failed()).toBeVisible();
		// Back: pressed with the keyboard, the read is made again, the banner goes and its focus goes on, not to the page's body.
		hooks.drop.delete("frame.counts");
		(again().element() as HTMLElement).focus();
		await userEvent.keyboard("{Tab}{Shift>}{Tab}{/Shift}{Enter}");
		await expect.element(failed()).not.toBeInTheDocument();
		await expect.poll(() => document.activeElement !== document.body && document.activeElement !== null).toBe(true);
	});

	it("[T154] a server that fails without a reason says the same, with nothing after it", async () => {
		const drawn = draw(activity.Log);
		await drawn.run();
		await expect.element(sidebar()).toBeVisible();
		const { hooks } = drawn.loaded();
		hooks.lose.add("frame.counts");
		window.dispatchEvent(new Event("focus"));
		await expect.element(failed()).toBeVisible();
		expect(failed().element().querySelector("[data-slot=banner-meta]")).toBeNull();
		hooks.lose.delete("frame.counts");
		await userEvent.click(failed().getByRole("button", { name: "다시 시도" }));
		await expect.element(failed()).not.toBeInTheDocument();
	});

	it("[T154] nothing read at all: the screen's own banner says it alone, and its 'try again' makes every failed read again", async () => {
		const drawn = draw({
			...activity.Log,
			loaders: ([] as unknown[]).concat(activity.Log.loaders ?? []).map((load) => async (...args: never[]) => {
				const made = await (load as (...all: never[]) => Promise<Loaded>)(...args);
				// Signed in, and then the network goes before the log's screen reads anything.
				for (const name of ["activity.list", "deliveries.counts", "frame.counts", "schema.read"])
					made.hooks.drop.add(name);
				return made;
			}),
		});
		await drawn.run();
		const own = page.getByRole("note").filter({ hasText: "기록을 불러오지 못했습니다" });
		await expect.element(own).toBeVisible();
		// One banner, the screen's own: the shared one waits while it speaks.
		expect(banners().filter((words) => words?.includes("불러오지 못했습니다"))).toHaveLength(1);
		const { hooks } = drawn.loaded();
		hooks.drop.clear();
		await userEvent.click(own.getByRole("button", { name: "다시 시도" }));
		await expect.poll(() => rows().all().length).toBeGreaterThan(1);
		await expect.element(sidebar()).toHaveTextContent(/^활동 기록1$/);
		expect(banners().some((words) => words?.includes("불러오지 못했습니다"))).toBe(false);
	});
});

describe("a list that has rows and is read again", () => {
	it("[T154] a later read that fails is said once, by the screen's own banner over the rows it read before, and its 'try again' reads again", async () => {
		const drawn = draw(activity.Log);
		await drawn.run();
		await expect.poll(() => rows().all().length).toBeGreaterThan(1);
		const { hooks } = drawn.loaded();
		hooks.drop.add("activity.list");
		// Searching reads the list again.
		location.hash = "#/activity?q=first";
		const own = page.getByRole("note").filter({ hasText: "기록을 불러오지 못했습니다" });
		await expect.element(own).toBeVisible();
		// One banner for the one matter: the shared one waits while the screen's own speaks.
		expect(banners().filter((words) => words?.includes("불러오지 못했습니다"))).toHaveLength(1);
		expect(rows().all().length).toBeGreaterThan(1);
		hooks.drop.clear();
		await userEvent.click(own.getByRole("button", { name: "다시 시도" }));
		await expect.element(own).not.toBeInTheDocument();
	});
});

describe("a screen whose first read does not come back", () => {
	it("[T154] the list says so at its top instead of standing empty with nothing said", async () => {
		const { composeStories } = await import("@storybook/react-vite");
		const frame = await import("./frame.stories");
		await composeStories(frame).ReadFailed.run();
		await expect.element(failed()).toBeVisible();
		await expect.element(failed().getByRole("button", { name: "다시 시도" })).toBeVisible();
		expect(banners()).toHaveLength(1);
	});
});

// The plugins' screens (doc 14) read as every screen does: a read that does not come back is said at the top (T154).
describe("the plugins' screens", () => {
	type PluginSite = { site: StorySite; id: string };
	/** The plugins' site, with the operations in `lost` getting no answer. */
	const pluginSite = async (
		options: Parameters<typeof import("../plugins/plugins.stories").site>[0],
		lost: Set<string>,
	) => {
		const plugins = await import("../plugins/plugins.stories");
		const story = scene<PluginSite>(
			{
				loaders: plugins.site(options).map((load) => async () => {
					const made = await load();
					const transport: StorySite["transport"] = async (name, ...rest) => {
						if (lost.has(name)) throw new TypeError("Failed to fetch");
						return made.site.transport(name, ...rest);
					};
					return { ...made, site: { ...made.site, transport } };
				}),
			},
			plugins.default,
		);
		await story.run();
		return story;
	};

	it("[T154] the tools' tabs: the plugin list that gets no answer is said at the top, and 'try again' brings the plugin's tab", async () => {
		const lost = new Set(["plugins.list"]);
		await pluginSite({ at: "tools" }, lost);
		await expect.element(failed()).toBeVisible();
		expect(await page.getByRole("link", { name: "검색 색인" }).elements()).toHaveLength(0);
		lost.clear();
		await userEvent.click(failed().getByRole("button", { name: "다시 시도" }));
		await expect.element(page.getByRole("link", { name: "검색 색인" })).toBeVisible();
		await expect.element(failed()).not.toBeInTheDocument();
	});

	it("[T154] the keys and the plugins' key slots: the list that gets no answer is said at the top, and 'try again' reads it", async () => {
		const lost = new Set(["keys.list"]);
		await pluginSite({ at: "tools" }, lost);
		await userEvent.click(page.getByRole("link", { name: "API 키" }));
		await expect.element(failed()).toBeVisible();
		lost.clear();
		await userEvent.click(failed().getByRole("button", { name: "다시 시도" }));
		await expect.element(failed()).not.toBeInTheDocument();
	});

	it("[T154] a plugin's own read of a file that is gone is a state it knows: the SEO preview draws no picture and nothing is said at the top", async () => {
		const plugins = await import("../plugins/plugins.stories");
		const { addFile } = await import("../media/media.stories");
		const asked: string[] = [];
		const story = scene<PluginSite>(
			{
				loaders: plugins.site({ at: "entry" }).map((load) => async () => {
					const made = await load();
					const { monti } = made.site;
					// The entry's share image is a file of the library, and the library then says it has no such file, in the server's own
					// words for one that went to the trash.
					const file = await addFile(made.site, {
						name: "share.jpg",
						from: "#335577",
						to: "#112233",
						width: 120,
						height: 63,
					});
					await monti.run(
						"entries.save",
						{ id: made.id, version: 1, values: { seoImage: { media: file } } },
						plugins.admin,
					);
					const transport: StorySite["transport"] = async (name, ...rest) => {
						if (name !== "media.get") return made.site.transport(name, ...rest);
						asked.push("refused");
						return { status: 422, body: { error: "check", reason: { key: "media.unknown", values: { id: file } } } };
					};
					return { ...made, site: { ...made.site, transport } };
				}),
			},
			plugins.default,
		);
		await story.run();
		await userEvent.click(page.getByRole("tab", { name: "SEO" }));
		await expect.element(page.getByRole("region", { name: "공유 카드" })).toBeVisible();
		// The file was asked for and refused.
		await expect.poll(() => asked.length).toBeGreaterThan(0);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(banners().some((words) => words?.includes("불러오지 못했습니다"))).toBe(false);
	});
});
