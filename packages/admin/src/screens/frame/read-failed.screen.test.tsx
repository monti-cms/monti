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

	it("[T154] a server that fails without a reason says the same, with nothing after it; a read whose refusal is a state the screen knows says nothing", async () => {
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
			loaders: activity.Log.loaders?.map((load) => async (...args: never[]) => {
				const made = (await (load as (...all: never[]) => Promise<Loaded>)(...args)) as Loaded;
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
