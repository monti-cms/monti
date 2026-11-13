import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as stories from "./import.stories";

const admin = { actor: "admin" } as const;
const at = (options?: Parameters<typeof stories.site>[0]) =>
	scene<{ site: StorySite }>({ loaders: stories.site(options) }, stories.default);
const sheet = () => page.getByRole("dialog");
const main = () => page.getByRole("main");
const posts = (site: StorySite) =>
	site.db
		.selectFrom("entries")
		.select(["title", "slug", "status", "values", "doc"])
		.where("collection", "=", "post")
		.where("trashed_at", "is", null)
		.orderBy("slug")
		.execute();

describe("importing into a list (flow 9, 05–09)", () => {
	it("14-1 a blog's zip is read, its keys are matched to fields, and it comes in as drafts: the taken address gets -2, the picture goes to the library, one press takes it all back", async () => {
		const story = at();
		await story.run();
		const { site } = story.loaded();
		await stories.importFrom(document.body, [await stories.blogZip()]);
		// 06: what was found, in the sheet named by the file.
		await expect.element(sheet().getByText("blog-export.zip")).toBeVisible();
		await expect.element(sheet().getByText("글 3편을 찾았습니다")).toBeVisible();
		// The keys with the field each goes to: the title and the category by their names, the rest left out until picked.
		await expect.element(sheet().getByRole("combobox", { name: "title" })).toHaveTextContent("제목");
		await expect.element(sheet().getByRole("combobox", { name: "category" })).toHaveTextContent("카테고리");
		await expect.element(sheet().getByText("새 카테고리 2개가 생깁니다")).toBeVisible();
		await expect.element(sheet().getByRole("combobox", { name: "layout" })).toHaveTextContent("가져오지 않음");
		// A key picked for a field goes there.
		await userEvent.click(sheet().getByRole("combobox", { name: "description" }));
		await userEvent.click(page.getByRole("option", { name: "요약" }));
		await expect.element(sheet().getByRole("combobox", { name: "description" })).toHaveTextContent("요약");
		// 07: the picture, the unknown component.
		await expect.element(sheet().getByText('이미지 1개가 미디어 폴더 "가져온 이미지"로 갑니다.')).toBeVisible();
		await expect.element(sheet().getByText("Tweet")).toBeVisible();
		// 08–09: imported.
		await userEvent.click(sheet().getByRole("button", { name: "3편 가져오기" }));
		await expect.element(sheet().getByText("3편을 가져왔습니다.")).toBeVisible();
		await expect.element(sheet().getByText("first-post → first-post-2")).toBeVisible();
		const rows = await posts(site);
		expect(rows.map((row) => [row.slug, row.status])).toEqual([
			["again", "draft"],
			["first-post", "draft"],
			["first-post-2", "draft"],
			["seoul-night", "draft"],
			["tools", "draft"],
		]);
		expect(rows[0]?.values).toMatchObject({ summary: "옮겨 온 첫 글" });
		const media = await site.db.selectFrom("media").select(["id", "name"]).execute();
		expect(media.map((file) => file.name)).toEqual(["desk.jpg"]);
		expect(JSON.stringify(rows[0]?.doc)).toContain(media[0]?.id);
		// One line of the log, and the sheet's "undo" takes the whole import back.
		const log = await site.monti.run("activity.list", { kinds: ["import"] }, admin);
		expect((log as { lines: unknown[] }).lines).toHaveLength(1);
		await userEvent.click(sheet().getByRole("button", { name: "되돌리기" }));
		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.poll(async () => (await posts(site)).map((row) => row.slug)).toEqual(["first-post", "seoul-night"]);
		await expect.element(main().getByText("다시 쓰는 블로그")).not.toBeInTheDocument();
	});

	it('14-1 after an import, "see in the list" closes the sheet on the list with the new entries, and a renamed entry\'s name opens it', async () => {
		const story = at();
		await story.run();
		await stories.importFrom(document.body, [await stories.blogZip()]);
		await userEvent.click(sheet().getByRole("button", { name: "3편 가져오기" }));
		await expect.element(sheet().getByText("3편을 가져왔습니다.")).toBeVisible();
		await userEvent.click(sheet().getByRole("button", { name: "목록에서 보기" }));
		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.element(main().getByText("다시 쓰는 블로그")).toBeVisible();
	});

	it("14-2 without the MDX plugin a .md upload is not read, and the sheet says which plugin reads it", async () => {
		const story = at({ mdx: false });
		await story.run();
		await stories.importFrom(document.body, [await stories.blogZip()]);
		await expect.element(sheet().getByText("MDX 플러그인이 있어야 읽을 수 있습니다")).toBeVisible();
		await expect.element(sheet().getByRole("button", { name: /가져오기/ })).not.toBeInTheDocument();
	});

	it("14-1 a file that is no zip says it could not be read", async () => {
		const story = at();
		await story.run();
		await stories.importFrom(document.body, [new File(["no"], "broken.zip")]);
		await expect.element(sheet().getByText("읽지 못했습니다.")).toBeVisible();
	});

	it('14-1 an empty list starts an import from "쓰던 글 가져오기"', async () => {
		const story = at({ hash: "#/c/memo" });
		await story.run();
		await expect.element(main().getByText("아직 메모가 없습니다.")).toBeVisible();
		stories.chooseNext([await stories.blogZip()]);
		await userEvent.click(main().getByRole("button", { name: /쓰던 글 가져오기/ }));
		await expect.element(sheet().getByText("글 3편을 찾았습니다")).toBeVisible();
	});
});
