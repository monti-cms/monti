import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { scene } from "../../test/scene";
import * as stories from "./assistant.stories";

type Loaded = stories.Loaded;
const open = (story: Parameters<typeof scene>[0]) => scene<Loaded>(story, stories.default);
const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const panel = () => page.getByRole("complementary", { name: "어시스턴트" });
const box = () => page.getByRole("textbox", { name: "어시스턴트에게 묻기" });

describe("asking (flow 2, 01–03)", () => {
	it("10-1 [flow 2·01] the panel opens with this screen's requests to start from; pressing one asks it", async () => {
		await open(stories.Answered).run();
		await expect.element(panel().getByText("글 목록 읽음 · 3편")).toBeVisible();
		await expect.element(button("셋째 글")).toBeVisible();
	});
});
