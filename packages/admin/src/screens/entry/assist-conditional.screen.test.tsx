import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as entry from "./entry.stories";

/**
 * The assistant's proposals and conditional fields in the entry editor (doc 19; T187, T195): a proposal for a field that is the entry's
 * (however deep its option), one for a field of an option that is not chosen, a proposed change of the choice itself, and a proposed
 * switch.
 */
type Loaded = { site: StorySite; id: string };

/** The entry with nested choices (a video, embedded; on the first page), with these values proposed by one request each. */
const proposing = (...changes: Record<string, unknown>[]) =>
	scene<Loaded>(
		{
			loaders: [
				async (): Promise<Loaded> => {
					const [load] = entry.site("nestedChoice") as [() => Promise<Loaded>];
					const made = await load();
					const read = (await made.site.monti.run("entries.get", { id: made.id }, entry.admin)) as {
						entry: { version: number };
					};
					for (const [index, values] of changes.entries()) {
						const proposal = await made.site.monti.proposals.create(`conversation-${index}`, `요청 ${index + 1}`);
						await made.site.monti.proposals.add(proposal, "entries.save", {
							id: made.id,
							version: read.entry.version,
							values,
						});
					}
					return made;
				},
			],
		},
		entry.default,
	);

const title = () => page.getByRole("textbox", { name: "제목" });
const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const field = (name: string) => page.getByRole("textbox", { name });
const saveCell = (text: string) =>
	expect
		.poll(() => [...document.querySelectorAll("[data-slot=status-bar-cell]")].map((cell) => cell.textContent))
		.toContain(text);
const stored = async ({ site, id }: Loaded) =>
	((await site.monti.run("entries.get", { id }, entry.admin)) as { entry: { values: Record<string, unknown> } }).entry
		.values;
const waiting = async ({ site }: Loaded) =>
	(await site.db.selectFrom("monti_proposal_item").select("state").execute()).map((item) => item.state);

describe("proposals and conditional fields in the editor (doc 19; T187, T195)", () => {
	it("19-5 a proposal for a field two choices deep is in its input, blue, with its discard: the bubble walks to it, and taken it is an unsaved change like any other", async () => {
		const made = proposing({ embedCode: "<iframe src='https://example.dev/new'></iframe>" });
		await made.run();
		await expect.element(title()).toBeVisible();
		// 글 종류 "동영상" › 영상 위치 "퍼가기" › 퍼가기 코드: the field is the entry's, so its proposal is drawn where the field is.
		await expect.element(field("퍼가기 코드")).toHaveValue("<iframe src='https://example.dev/new'></iframe>");
		expect(field("퍼가기 코드").element().hasAttribute("data-proposal")).toBe(true);
		await expect.element(page.getByText("1 / 1")).toBeVisible();
		await expect.element(button("퍼가기 코드 제안 버리기")).toBeVisible();
		await userEvent.click(button("모두 받기"));
		await saveCell("저장 전 변경사항");
		expect(field("퍼가기 코드").element().hasAttribute("data-proposal")).toBe(false);
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await expect
			.poll(async () => (await stored(made.loaded())).embedCode)
			.toBe("<iframe src='https://example.dev/new'></iframe>");
		expect(await waiting(made.loaded())).toEqual(["applied"]);
	});

	it("19-5 T187 a proposal for a field of an option that is not chosen is not in the panel and the bubble does not count it; choosing that option shows it in its field", async () => {
		// The entry is a video: a link's address is not its field now.
		const made = proposing({ linkUrl: "https://example.dev/read" }, { embedCode: "<iframe></iframe>" });
		await made.run();
		await expect.element(title()).toBeVisible();
		await expect.element(field("퍼가기 코드")).toHaveValue("<iframe></iframe>");
		await expect.element(field("링크 주소")).not.toBeInTheDocument();
		// One of the two waits where the editor can show it.
		await expect.element(page.getByText("1 / 1")).toBeVisible();
		// The person makes the entry a link: the field is there now, and its proposal with it.
		await userEvent.click(page.getByRole("combobox", { name: "글 종류" }));
		await userEvent.click(page.getByRole("option", { name: "링크" }));
		await expect.element(field("링크 주소")).toHaveValue("https://example.dev/read");
		expect(field("링크 주소").element().hasAttribute("data-proposal")).toBe(true);
	});

	it("19-5 a proposed change of the choice is blue in the choice; the fields under it stay the entry's own, and what taking it would clear is said under it", async () => {
		const made = proposing({ format: "link" });
		await made.run();
		await expect.element(title()).toBeVisible();
		const choice = page.getByRole("combobox", { name: "글 종류" });
		await expect.element(choice).toHaveTextContent("링크");
		expect(choice.element().hasAttribute("data-proposal")).toBe(true);
		// The entry is still a video until the proposal is taken: its own fields are the ones shown, not the link's.
		await expect.element(field("동영상 주소")).toHaveValue("https://example.dev/talk.mp4");
		await expect.element(field("퍼가기 코드")).toBeVisible();
		await expect.element(field("링크 주소")).not.toBeInTheDocument();
		// The video's address, where it is and its embed code hold values.
		await expect.element(page.getByText("받으면 동영상의 값 3개가 지워집니다")).toBeVisible();
		await expect.element(page.getByText(/저장하면 .*지워집니다/)).not.toBeInTheDocument();

		// Taken, it is the person's change: the link's fields take the video's place, and the save is what clears.
		await userEvent.click(button("모두 받기"));
		await expect.element(field("링크 주소")).toBeVisible();
		await expect.element(field("동영상 주소")).not.toBeInTheDocument();
		await expect.element(page.getByText("저장하면 동영상의 값 3개가 지워집니다")).toBeVisible();
		await expect.element(page.getByText(/받으면/)).not.toBeInTheDocument();
		// Nothing is stored until the person saves.
		expect((await stored(made.loaded())).format).toBe("video");
	});

	it("19-5 discarding a proposed change of the choice leaves the entry's choice and its fields as they were", async () => {
		const made = proposing({ format: "link" });
		await made.run();
		await expect.element(title()).toBeVisible();
		await userEvent.click(button("글 종류 제안 버리기"));
		await expect.element(page.getByRole("combobox", { name: "글 종류" })).toHaveTextContent("동영상");
		await expect.element(page.getByText(/받으면/)).not.toBeInTheDocument();
		await expect.poll(() => waiting(made.loaded())).toEqual(["discarded"]);
		await saveCell("저장됨");
	});

	it("19-5 a proposed switch has the proposal's dot by its name and '버리기' before it, as a proposed switch has everywhere; discarded, it stands as the entry has it", async () => {
		const made = proposing({ featured: null });
		await made.run();
		await expect.element(title()).toBeVisible();
		const on = page.getByRole("switch", { name: /첫 화면에 올리기/ });
		await expect.element(on).not.toBeChecked();
		expect(on.element().hasAttribute("data-proposal")).toBe(true);
		const row = on.element().closest("[data-slot=field]");
		expect(row?.querySelector("[data-slot=change-dot]")).not.toBeNull();
		// Turning it off would drop the note under it: said before it is taken.
		await expect.element(page.getByText("받으면 첫 화면에 올리기의 값 1개가 지워집니다")).toBeVisible();
		await userEvent.click(button("첫 화면에 올리기 제안 버리기"));
		await expect.element(on).toBeChecked();
		expect(on.element().hasAttribute("data-proposal")).toBe(false);
		await expect.element(field("첫 화면 문구")).toHaveValue("이번 주의 글");
		await expect.poll(() => waiting(made.loaded())).toEqual(["discarded"]);
	});
});

describe("the review page and conditional fields (doc 19; T187, T195)", () => {
	/** Two posts on the blog with a kind: a link with no address yet, and a video. One request proposes a link address for both. */
	const reviewing = async () => {
		const story = scene<Loaded>({ loaders: entry.site("conditional") }, entry.default);
		await story.run();
		await expect.element(title()).toBeVisible();
		const made = story.loaded();
		const run = <Output,>(name: string, input: unknown) =>
			made.site.monti.run(name, input, entry.admin) as Promise<Output>;
		const link = (
			await run<{ output: { id: string } }>("entries.create", {
				collection: "post",
				locale: "ko",
				title: "읽을거리 모음",
				slug: "reading-list",
				values: { format: "link", linkUrl: "https://example.dev/old" },
			})
		).output.id;
		await run("entries.save", { id: made.id, version: 1, title: "발표 영상" });
		const proposal = await made.site.monti.proposals.create("conversation-1", "링크 주소가 빈 글에 주소를 채워 줘.");
		const add = (id: string, values: Record<string, unknown>) =>
			made.site.monti.proposals.add(
				proposal,
				"entries.save",
				{ id, version: id === made.id ? 2 : 1, values },
				"링크 주소 채우기",
			);
		await add(link, { linkUrl: "https://example.dev/reading" });
		await add(made.id, { linkUrl: "https://example.dev/talk" });
		window.location.hash = `#/ai/review/${proposal}`;
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		return { made, proposal };
	};

	it("19-5 T187 a change of a field of an option the entry has not chosen is a row left out, its check not to be put in, with why at its end; the pill counts only what can be applied", async () => {
		const { made, proposal } = await reviewing();
		const reading = page.getByRole("checkbox", { name: "읽을거리 모음 넣기" });
		const talk = page.getByRole("checkbox", { name: "발표 영상 넣기" });
		await expect.element(reading).toBeChecked();
		await expect.element(talk).not.toBeChecked();
		// The field is named as the editor names it, and the reason by the choice and the option it needs.
		await expect.element(page.getByText("링크 주소").first()).toBeVisible();
		await expect.element(page.getByText("글 종류가 링크가 아님")).toBeVisible();
		await expect.element(button("1건 적용")).toBeVisible();
		await userEvent.click(talk, { force: true });
		await expect.element(talk).not.toBeChecked();
		// Applying does the one that fits and leaves the video as it was.
		await userEvent.click(button("1건 적용"));
		await expect.element(page.getByText("✓ 1건 적용")).toBeVisible();
		expect((await stored(made)).linkUrl).toBeUndefined();
		const states = await made.site.db
			.selectFrom("monti_proposal_item")
			.select("state")
			.where("proposal_id", "=", proposal)
			.orderBy("position")
			.execute();
		expect(states.map((item) => item.state)).toEqual(["applied", "discarded"]);
	});

	it("19-5 T195 a change of the choice shows what goes with the option it leaves: the entry's values of that option, struck out beside the new choice", async () => {
		const { made } = await reviewing();
		const other = await made.site.monti.proposals.create("conversation-2", "발표 영상을 링크 글로 바꿔 줘");
		await made.site.monti.proposals.add(
			other,
			"entries.save",
			{ id: made.id, version: 2, values: { format: "link", linkUrl: "https://example.dev/talk" } },
			"링크 글로 바꾸기",
		);
		window.location.hash = `#/ai/review/${other}`;
		const section = page.getByRole("table", { name: "링크 글로 바꾸기" });
		await expect.element(section.getByRole("checkbox", { name: "발표 영상 넣기" })).toBeChecked();
		// The choice by its labels, going from one to the other.
		await expect.element(section.getByText("글 종류")).toBeVisible();
		const struck = () => [...section.element().querySelectorAll("del")].map((each) => each.textContent);
		await expect.poll(struck).toContain("https://example.dev/talk.mp4");
		expect(struck()).toContain("example.dev");
		await expect.element(section.getByText("동영상 주소")).toBeVisible();
		await expect.element(section.getByText("출처")).toBeVisible();
	});
});
