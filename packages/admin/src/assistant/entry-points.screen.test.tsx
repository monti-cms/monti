import type { ProposalView } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { scene } from "../../test/scene";
import * as stories from "./assistant.stories";

/**
 * The assistant's entry points outside the editor (doc 10; T58, T124, T141) and the states of the review page not tried before (T165,
 * T187): the list's "✦ request", the trash's ✦, the activity log's "conversation", an apply cut short, and the rows of the bundles that
 * move, publish, throw away and translate. The model is the scripted one.
 */
type Loaded = stories.Loaded;
const on = (options: Parameters<typeof stories.site>[0]) =>
	scene<Loaded>({ loaders: stories.site(options) }, stories.default);
const GROUP = "_group";
const admin = stories.admin;

const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const panel = () => page.getByRole("complementary", { name: "어시스턴트" });
const box = () => page.getByRole("textbox", { name: "어시스턴트에게 묻기" });
const row = (name: string) => page.getByRole("row").filter({ hasText: name });
async function listed() {
	await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
}
async function openPanel() {
	await listed();
	await userEvent.click(button("어시스턴트 열기"));
	await expect.element(box()).toBeVisible();
}
async function say(words: string) {
	await userEvent.fill(box(), words);
	await userEvent.keyboard("{Enter}");
}
const go = async (hash: string) => {
	window.location.hash = hash;
};
const run = <Output,>(loaded: Loaded, name: string, input: unknown) =>
	loaded.site.monti.run(name, input, admin) as Promise<Output>;
const versionOf = async (loaded: Loaded, id: string) =>
	(await run<{ entry: { version: number } }>(loaded, "entries.get", { id })).entry.version;
const view = (loaded: Loaded, id: string) => run<ProposalView>(loaded, "proposals.get", { id });

describe("the list: '✦ request' on the picked rows (T58; doc 10, item 27)", () => {
	it("10-1 [flow 2·07] picking rows puts '요청' on the bulk bar: it opens the panel with the picked rows as a chip and the caret in the box, and sends nothing", async () => {
		const story = on({});
		await story.run();
		await listed();
		await userEvent.click(page.getByRole("checkbox", { name: /둘째 글/ }));
		await userEvent.click(page.getByRole("checkbox", { name: /셋째 글/ }));
		await userEvent.click(button("요청"));
		await expect.element(box()).toBeVisible();
		await expect.element(panel().getByText("고른 글 2편")).toBeVisible();
		await expect.poll(() => document.activeElement === box().element()).toBe(true);
		expect(story.loaded().model.turns).toHaveLength(0);
		// The chip taken off comes back when the request is asked for again: the rows are what it is about.
		await userEvent.click(button(/고른 글 2편 빼기|고른 글 2편/).last());
		await userEvent.click(button("요청"));
		await expect.element(panel().getByText("고른 글 2편")).toBeVisible();
	});

	it("10-1 a site without the assistant has no '요청' on the bulk bar", async () => {
		const story = on({ plugin: false });
		await story.run();
		await listed();
		await userEvent.click(page.getByRole("checkbox", { name: /둘째 글/ }));
		await expect.element(page.getByText("1개 선택")).toBeVisible();
		await expect.element(button("요청")).not.toBeInTheDocument();
	});
});

describe("the trash and the activity log open the conversation (T124, T141)", () => {
	/** "Throw the second post away": one proposed move to the trash, applied from its card. */
	const thrownAway = async () => {
		const story = on({
			script: (ids) => [
				{
					calls: [{ name: "trash_move", input: { rows: [{ kind: "entry", id: ids.second }], [GROUP]: "휴지통으로" } }],
				},
				{ text: "둘째 글을 휴지통으로 옮기자고 제안했습니다." },
			],
		});
		await story.run();
		await openPanel();
		await say("둘째 글 버려 줘");
		await userEvent.click(button("1건 적용"));
		await expect.element(panel().getByText("✓ 1건 적용")).toBeVisible();
		// Another conversation, and the panel shut: what opens next is opened by the screen.
		await userEvent.click(button("새 대화"));
		await userEvent.click(button("닫기"));
		await expect.element(box()).not.toBeInTheDocument();
		return story;
	};

	// Once that conversation is deleted the ✦ is a mark again, and opens nothing.
	it("11 T124 [flow 5·15] in the trash, the ✦ of what the assistant threw away opens the conversation it was asked in, while that conversation is kept", async () => {
		const story = await thrownAway();
		await go("#/trash");
		await expect.element(row("둘째 글")).toBeVisible();
		await userEvent.click(button("버린 대화 열기"));
		await expect.element(panel().getByText("둘째 글 버려 줘")).toBeVisible();
		await expect.element(panel().getByText("둘째 글을 휴지통으로 옮기자고 제안했습니다.")).toBeVisible();

		const [conversation] = await story.loaded().site.db.selectFrom("conversations").select("id").execute();
		await run(story.loaded(), "conversations.remove", { id: conversation?.id });
		await userEvent.click(button("닫기"));
		await go("#/trash?sort=title");
		await expect.element(row("둘째 글")).toBeVisible();
		await expect.element(button("버린 대화 열기")).not.toBeInTheDocument();
		await expect.element(page.getByRole("img", { name: "어시스턴트가 버림" })).toBeVisible();
	});

	it("13 T141 the activity log's ✦ line has '대화' in its ⋯: it opens the conversation of that request; a person's line has no such row", async () => {
		const story = await thrownAway();
		await run(story.loaded(), "entries.save", {
			id: story.loaded().ids.first,
			version: await versionOf(story.loaded(), story.loaded().ids.first),
			title: "첫 번째 글, 손으로",
		});
		await go("#/activity");
		const line = row("둘째 글 버려 줘");
		await expect.element(line).toBeVisible();
		await userEvent.click(line.getByRole("button", { name: "더 보기" }));
		await userEvent.click(page.getByRole("menuitem", { name: "대화" }));
		await expect.element(panel().getByText("둘째 글을 휴지통으로 옮기자고 제안했습니다.")).toBeVisible();
		await userEvent.click(button("닫기"));
		const mine = row("첫 번째 글, 손으로");
		await userEvent.click(mine.getByRole("button", { name: "더 보기" }));
		await expect.element(page.getByRole("menuitem", { name: "자세히" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "대화" })).not.toBeInTheDocument();
	});
});

describe("the review page: states not tried before (T165)", () => {
	/** A proposal made on the site's own engine, as a run makes one, and its review page opened. */
	const reviewing = async (make: (loaded: Loaded, proposal: string) => Promise<void>) => {
		const story = on({});
		await story.run();
		await listed();
		const loaded = story.loaded();
		const at = new Date();
		await loaded.site.db
			.insertInto("conversations")
			.values({ id: "c-review", title: "검토", created_at: at, last_opened_at: at })
			.execute();
		const proposal = await loaded.site.monti.proposals.create("c-review", "정리해 줘");
		await make(loaded, proposal);
		await go(`#/ai/review/${proposal}`);
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		return { loaded, proposal };
	};
	const summaries = async (loaded: Loaded, proposal: string) => {
		const { ids } = loaded;
		for (const [id, summary] of [
			[ids.first, "첫 글의 새 요약."],
			[ids.second, "둘째 글의 요약."],
			[ids.third, "셋째 글의 요약."],
		] as const)
			await loaded.site.monti.proposals.add(
				proposal,
				"entries.save",
				{ id, version: await versionOf(loaded, id), values: { summary } },
				"요약 채우기",
			);
	};

	it("10-4 an apply cut short after its first change: that row says '적용', the others still wait with their checks, and the pill counts what is left; applying again does only those", async () => {
		const { loaded, proposal } = await reviewing(summaries);
		// What an apply that died after its first write leaves behind (the engine's own test cuts a real one): that change applied
		// with its line in the log, the others still waiting, and nobody holding the proposal.
		const [first] = (await view(loaded, proposal)).items;
		await loaded.site.monti.proposals.apply(proposal, [first?.id ?? ""]);
		await loaded.site.db
			.updateTable("monti_proposal_item")
			.set({ state: "pending", reason: null })
			.where("proposal_id", "=", proposal)
			.where("state", "<>", "applied")
			.execute();
		await loaded.site.db.updateTable("monti_proposal").set({ status: "pending" }).where("id", "=", proposal).execute();
		expect((await view(loaded, proposal)).items.map((item) => item.state)).toEqual(["applied", "pending", "pending"]);
		// The page is opened again, as after the browser lost the apply's stream.
		await go("#/c/post");
		await listed();
		await go(`#/ai/review/${proposal}`);
		await expect.element(row("첫 번째 글").getByText("적용", { exact: true })).toBeVisible();
		await expect.element(button("2건 적용")).toBeVisible();
		// The applied row's check is settled; the waiting ones can still be taken out.
		await expect.element(page.getByRole("checkbox", { name: "둘째 글 넣기" })).toBeChecked();
		await userEvent.click(page.getByRole("checkbox", { name: "셋째 글 넣기" }));
		await expect.element(button("1건 적용")).toBeVisible();
		await userEvent.click(button("1건 적용"));
		await expect.element(row("둘째 글").getByText("적용", { exact: true })).toBeVisible();
		expect((await view(loaded, proposal)).items.map((item) => item.state)).toEqual(["applied", "applied", "discarded"]);
	});

	it("10-1 a bundle that moves, publishes and throws away: each record is a row with its check, named by what it is; one that cannot be published is left out with why", async () => {
		const { loaded, proposal } = await reviewing(async (made, id) => {
			const { ids } = made;
			const folder = (
				await run<{ output: { id: string } }>(made, "folders.create", {
					scope: { collection: "post" },
					parentId: null,
					name: "2024",
				})
			).output.id;
			// A post with no address cannot be published: its to-do row blocks it.
			const untitled = (
				await run<{ output: { id: string } }>(made, "entries.create", {
					collection: "post",
					locale: "ko",
					title: "주소 없는 글",
				})
			).output.id;
			await made.site.db.updateTable("entries").set({ slug: "" }).where("id", "=", untitled).execute();
			const add = made.site.monti.proposals.add;
			await add(id, "entries.moveToFolder", { ids: [ids.first, ids.second], folder }, "2024로 옮기기");
			await add(id, "entries.publish", { ids: [ids.first, untitled] }, "발행");
			await add(id, "trash.move", { rows: [{ kind: "entry", id: ids.third }] }, "휴지통으로");
		});
		// Three kinds of change, each a titled list; a write of several records is a row for each.
		const section = (name: string) => page.getByRole("table", { name });
		await expect.poll(() => section("2024로 옮기기").getByRole("checkbox").elements().length).toBe(2);
		await expect.element(section("2024로 옮기기").getByRole("checkbox", { name: "첫 번째 글 넣기" })).toBeChecked();
		await expect.element(section("휴지통으로").getByRole("checkbox", { name: "셋째 글 넣기" })).toBeChecked();
		// The post that cannot be published is left out and cannot be put in; its row's end says why.
		const blocked = section("발행").getByRole("checkbox", { name: "주소 없는 글 넣기" });
		await expect.element(blocked).not.toBeChecked();
		await userEvent.click(blocked, { force: true });
		await expect.element(blocked).not.toBeChecked();
		// Why, in the words its own write gave when it was proposed.
		const why = (await view(loaded, proposal)).items.find((item) => item.blocked !== null)?.blocked;
		expect(why).toBeTruthy();
		const end = blocked.element().closest("tr")?.querySelector("td:last-child")?.textContent ?? "";
		expect(end.trim().length).toBeGreaterThan(0);
		expect((await view(loaded, proposal)).counts.toApply).toBe(4);
		await expect.element(button("4건 적용")).toBeVisible();
		// "Leave all out" counts the rows that can go in: the two that move have it, the publish with one such row has none.
		await expect.element(button("2건 모두 빼기")).toBeVisible();
		expect(page.getByRole("button", { name: /모두 빼기/ }).elements()).toHaveLength(1);
	});

	it("10-1 [flow 3·13] a bundle that makes translations: each entry is a row that opens to its source beside the translation, with how many blocks it has; '모두 펼치기' opens them all", async () => {
		const { loaded } = await reviewing(async (made, id) => {
			const { ids } = made;
			await run(made, "entries.save", {
				id: ids.second,
				version: await versionOf(made, ids.second),
				doc: {
					type: "doc",
					blocks: [
						{ id: "b1", type: "paragraph", content: [{ type: "text", text: "관리자 화면을 처음 엽니다." }] },
						{ id: "b2", type: "codeBlock", content: [{ type: "text", text: "pnpm dev" }] },
					],
				},
			});
			const add = made.site.monti.proposals.add;
			const second = await add(id, "translations.create", { source: ids.second, locale: "en" }, "새 글");
			await add(id, "translations.create", { source: ids.third, locale: "en" }, "새 글");
			// The words for the translation the proposal makes: they go with that translation's row.
			await add(
				id,
				"entries.save",
				{
					id: { $item: second.itemId },
					version: 1,
					title: "The second post",
					doc: {
						type: "doc",
						blocks: [
							{
								id: "t1",
								type: "paragraph",
								link: { from: "b1", seen: "", state: "translated" },
								content: [{ type: "text", text: "Opening the admin for the first time." }],
							},
						],
					},
				},
				"새 글",
			);
		});
		const section = page.getByRole("table", { name: "새 글" });
		// Two entries, two rows: the words written into the first translation are part of its row, not a row of their own.
		await expect.poll(() => section.getByRole("checkbox").elements().length).toBe(2);
		await expect.element(section.getByText("블록 1 · 원문 따름 1")).toBeVisible();
		await expect.element(page.getByText("Opening the admin for the first time.")).not.toBeInTheDocument();
		await userEvent.click(section.getByRole("button", { name: "펼치기" }).first());
		await expect.element(section.getByText("원문 · 한국어")).toBeVisible();
		await expect.element(section.getByText("번역 · English")).toBeVisible();
		await expect.element(section.getByText("Opening the admin for the first time.")).toBeVisible();
		await expect.element(section.getByText("The second post")).toBeVisible();
		await userEvent.click(button("모두 펼치기"));
		await expect.poll(() => section.getByRole("button", { name: "접기" }).elements().length).toBe(2);
		// Taking the translation out takes its words out with it: one check for the entry.
		await userEvent.click(section.getByRole("checkbox", { name: "둘째 글 넣기" }));
		await expect.element(button("1건 적용")).toBeVisible();
		const items = (
			await view(loaded, (await loaded.site.db.selectFrom("monti_proposal").select("id").execute())[0]?.id ?? "")
		).items;
		expect(items.map((item) => item.included)).toEqual([false, true, false]);
	});
});
