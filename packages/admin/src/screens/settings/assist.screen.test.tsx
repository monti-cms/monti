import type { ScriptedProvider } from "@monti-cms/ai";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import { assisted } from "../../assistant/assistant.stories";
import { schema } from "../story-schema";
import * as collections from "./collections.stories";

/**
 * One proposal's own card in the settings (doc 05, "one by one"; T41), and a proposed switch (the same everywhere). The card is the
 * editor's: it opens from the mark that stands by the bubble, for the proposal the bubble points at.
 */
type Loaded = { site: StorySite; model: ScriptedProvider };
const GROUP = "_group";

/** A field the assistant proposed for the posts ("readingTime"), and for the memos one more request: folders turned on. */
const proposing = async ({ monti }: StorySite) => {
	const draft = structuredClone(schema);
	(draft.collections.post as { fields: Record<string, unknown> }).fields.readingTime = { kind: "text", max: 10 };
	const field = await monti.proposals.create("conversation-1", "읽는 시간 필드 더해 줘");
	await monti.proposals.add(field, "schema.apply", { draft, renames: [], answers: {} });
	const folders = await monti.proposals.create("conversation-2", "게시글 폴더는 꺼 줘");
	await monti.proposals.add(folders, "collections.updateAdminValues", {
		collection: "post",
		values: { folders: false },
	});
};
const on = (assistantOn = true) =>
	scene<Loaded>(
		{ loaders: [...(assistantOn ? [assisted()] : []), ...collections.site({ more: proposing })] },
		collections.default,
	);
const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const waiting = async ({ site }: Loaded) =>
	(
		await site.db
			.selectFrom("monti_proposal_item")
			.select(["operation", "state", "input"])
			.orderBy("operation", "desc")
			.execute()
	).map((item) => ({ operation: item.operation, state: item.state, input: item.input as Record<string, unknown> }));

async function opened() {
	await userEvent.click(button("설정"));
	await userEvent.click(page.getByRole("link", { name: /^컬렉션/ }));
	await expect.element(button("readingTime 열기")).toBeVisible();
}

describe("the settings: one proposal's own card (T41; doc 05, 'one by one')", () => {
	it("10-1 the mark by the bubble opens the card of the proposal the bubble points at: '버리기', '받기', the request, and a box to go on", async () => {
		const made = on();
		await made.run();
		await opened();
		await expect.element(page.getByText("1 / 2")).toBeVisible();
		await userEvent.click(button("제안: 읽는 시간 필드 더해 줘"));
		await expect.element(button("받기")).toBeVisible();
		await expect.element(button("버리기").last()).toBeVisible();
		await expect
			.poll(() => [...document.querySelectorAll("[data-slot=memo-message]")].map((message) => message.textContent))
			.toEqual(["나읽는 시간 필드 더해 줘"]);
		await expect.element(page.getByRole("textbox", { name: "이어서 요청" })).toBeVisible();
		// The bubble steps on: the mark is the next proposal's.
		await userEvent.keyboard("{Escape}");
		await userEvent.click(button("다음"));
		await expect.element(button("제안: 게시글 폴더는 꺼 줘")).toBeVisible();
	});

	it("10-3 '받기' on the card takes that proposal alone into the draft: it is an unsaved change, and the other proposal still waits", async () => {
		const made = on();
		await made.run();
		await opened();
		await userEvent.click(button("제안: 읽는 시간 필드 더해 줘"));
		await userEvent.click(button("받기"));
		// One change now, one proposal left; nothing is saved.
		await expect.element(button("변경 사항")).toHaveTextContent(/1/);
		await expect.element(page.getByText("1 / 1")).toBeVisible();
		await expect.element(button("제안: 게시글 폴더는 꺼 줘")).toBeVisible();
		expect((await waiting(made.loaded())).map((item) => item.state)).toEqual(["pending", "pending"]);
	});

	it("10-1 '이어서 요청' on the card has that proposal made differently: the mark says '…' meanwhile, and the proposal is replaced where it stood", async () => {
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const made = on();
		await made.run();
		const draft = structuredClone(schema);
		(draft.collections.post as { fields: Record<string, unknown> }).fields.readingTime = { kind: "text", max: 20 };
		made.loaded().model.add(
			{
				hold: gate,
				calls: [{ name: "schema_apply", input: { draft, renames: [], answers: {}, [GROUP]: "필드 더하기" } }],
			},
			{ text: "최대 글자 수를 20으로 바꿨습니다." },
		);
		await opened();
		await userEvent.click(button("제안: 읽는 시간 필드 더해 줘"));
		await userEvent.fill(page.getByRole("textbox", { name: "이어서 요청" }), "20자까지로 해 줘");
		await userEvent.keyboard("{Enter}");
		await expect.element(button("고치는 중인 제안: 읽는 시간 필드 더해 줘")).toBeVisible();
		await expect.element(page.getByText("고치는 중…")).toBeVisible();
		release();
		await expect.element(page.getByText("최대 글자 수를 20으로 바꿨습니다.")).toBeVisible();
		const [field] = await waiting(made.loaded());
		expect(field?.state).toBe("pending");
		expect(JSON.stringify(field?.input)).toContain('"max":20');
		// Still two proposals: the one asked about was made again in its place.
		expect(await waiting(made.loaded())).toHaveLength(2);
	});

	it("10-1 a site without the assistant has the card with no box to ask in: a proposal is still taken or discarded one by one", async () => {
		const made = on(false);
		await made.run();
		await opened();
		await userEvent.click(button("제안: 읽는 시간 필드 더해 줘"));
		await expect.element(button("받기")).toBeVisible();
		await expect.element(page.getByRole("textbox", { name: "이어서 요청" })).not.toBeInTheDocument();
		await userEvent.click(button("버리기").last());
		await expect.element(page.getByText("1 / 1")).toBeVisible();
		expect((await waiting(made.loaded())).map((item) => item.state)).toEqual(["discarded", "pending"]);
	});
});

describe("the settings: a proposed switch (the same everywhere)", () => {
	it("10-1 a collection's switch the assistant proposed has the proposal's dot by its name and '버리기' before it; discarded, it stands as saved", async () => {
		const made = on(false);
		await made.run();
		await opened();
		await userEvent.click(button("기본"));
		const folders = page.getByRole("switch", { name: "폴더 사용" });
		await expect.element(folders).not.toBeChecked();
		expect(folders.element().hasAttribute("data-proposal")).toBe(true);
		const row = folders.element().parentElement?.parentElement;
		expect(row?.querySelector("[data-slot=change-dot]")).not.toBeNull();
		await userEvent.click(row?.querySelector("button[data-slot=text-button]") as HTMLElement);
		await expect.element(page.getByRole("switch", { name: "폴더 사용" })).toBeChecked();
		expect(page.getByRole("switch", { name: "폴더 사용" }).element().hasAttribute("data-proposal")).toBe(false);
		await expect
			.poll(async () => (await waiting(made.loaded())).find((item) => item.operation.startsWith("collections"))?.state)
			.toBe("discarded");
	});
});
