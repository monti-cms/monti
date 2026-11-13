import { unzip } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import type { catchDownloads } from "../list/import.stories";
import * as stories from "./data.stories";

type Loaded = { site: StorySite; saved: ReturnType<typeof catchDownloads> };
const at = (options?: Parameters<typeof stories.site>[0]) =>
	scene<Loaded>({ loaders: stories.site(options) }, stories.default);
const main = () => page.getByRole("main");
const filesOf = async (file: Blob) => unzip(new Uint8Array(await file.arrayBuffer()))?.names ?? [];

describe("tools › data: the backup (flow 9, 01–03)", () => {
	it("14-1 the tools have a data tab between the templates and the keys, and it holds the backup with its last time", async () => {
		await at().run();
		const tabs = page.getByRole("navigation", { name: "도구" }).or(main()).getByRole("link");
		await expect.element(main().getByRole("link", { name: "데이터" })).toHaveAttribute("aria-current", "page");
		expect(tabs.elements().map((tab) => tab.textContent)).toEqual(
			expect.arrayContaining(["템플릿", "데이터", "API 키"]),
		);
		await expect.element(main().getByText("마지막 백업")).toHaveTextContent("없음");
		await expect.element(main().getByRole("checkbox", { name: /미디어 파일도 담기/ })).not.toBeChecked();
	});

	it("14-1 a press takes the backup at once: a zip of the site's files without the media, the toast, and the last backup is now", async () => {
		const story = at();
		await story.run();
		const { saved } = story.loaded();
		await userEvent.click(main().getByRole("button", { name: "백업 받기" }));
		await expect.element(page.getByText("백업을 저장했습니다")).toBeVisible();
		expect(saved).toHaveLength(1);
		expect(saved[0]?.name).toMatch(/^monti-backup-\d{4}-\d{2}-\d{2}\.zip$/);
		const names = await filesOf((saved[0] as { file: Blob }).file);
		expect(names).toEqual(expect.arrayContaining(["manifest.json", "schema.json", "entries.jsonl", "media.jsonl"]));
		expect(names.filter((name) => name.startsWith("media/"))).toEqual([]);
		await expect.element(main().getByText("마지막 백업")).not.toHaveTextContent("없음");
	});

	it('14-1 with "미디어 파일도 담기" the zip has the library\'s files beside the text files', async () => {
		const story = at();
		await story.run();
		const { saved } = story.loaded();
		await userEvent.click(main().getByRole("checkbox", { name: /미디어 파일도 담기/ }));
		await userEvent.click(main().getByRole("button", { name: "백업 받기" }));
		await expect.element(page.getByText("백업을 저장했습니다")).toBeVisible();
		const names = await filesOf((saved[0] as { file: Blob }).file);
		expect(names).toContain("media/00000000-0000-4000-8000-000000000001.jpg");
	});

	it("14-1 a library with no file offers no media to take", async () => {
		await at({ picture: false }).run();
		await expect.element(main().getByRole("button", { name: "백업 받기" })).toBeVisible();
		await expect.element(main().getByRole("checkbox")).not.toBeInTheDocument();
	});

	it("14-1 while the backup is made the pill works and says how far it is, and a second press starts nothing", async () => {
		const story = scene<Loaded>(stories.Making, stories.default);
		await story.run();
		const pill = main().getByRole("button", { name: /만드는 중 0%/ });
		await expect.element(pill).toBeVisible();
		await userEvent.click(pill, { force: true });
		expect(story.loaded().saved).toEqual([]);
		await expect.element(main().getByRole("checkbox", { name: /미디어 파일도 담기/ })).toBeDisabled();
	});
});
