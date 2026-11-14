import { describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { caretAfter, pointerPath } from "../../../../../testing/input";
import { scene } from "../../../test/scene";
import * as stories from "../../assistant/assistant.stories";

/**
 * An open editor after a write made elsewhere in the admin (AS-47, TR-22): the assistant's proposal for the entry, applied from its
 * panel's card, writes to the server at once. With nothing unsaved the editor shows the server's copy again, values and state; over unsaved
 * changes it does not write them over and says so with the conflict banner (doc 02, principle 3).
 */
type Loaded = stories.Loaded;
const GROUP = "_group";
const admin = stories.admin;
const SUMMARY = "적용 뒤의 새 요약입니다.";

const FIRST = "탭과 단 사이의 첫 문단입니다.";
const SECOND = "두 번째 문단입니다.";
const NEW_BODY = "어시스턴트가 바꾼 본문입니다.";
const paragraph = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text", text }] });
const BODY = { type: "doc", blocks: [paragraph("b_1", FIRST), paragraph("b_2", SECOND)] };

/**
 * The first post, published, and a model that proposes a new summary for it (`body`: a new body with it). The proposal is made on the entry as
 * the test leaves it when it asks (a body given and a publish are versions).
 */
const proposing = (change: { body?: boolean } = {}) =>
	scene<Loaded>(
		{
			loaders: stories.site({
				script: (ids, version) => [
					async () => ({
						calls: [
							{
								name: "entries_save",
								input: {
									id: ids.first,
									version: await version(ids.first),
									values: { summary: SUMMARY },
									...(change.body ? { doc: { type: "doc", blocks: [paragraph("b_1", NEW_BODY)] } } : {}),
									[GROUP]: "요약 고치기",
								},
							},
						],
					}),
					{ text: "요약을 고치자고 제안했습니다." },
				],
			}),
		},
		stories.default,
	);

const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const panel = () => page.getByRole("complementary", { name: "어시스턴트" });
const box = () => page.getByRole("textbox", { name: "어시스턴트에게 묻기" });
const title = () => page.getByRole("textbox", { name: "제목" });
// The story site's schema names its fields by their keys.
const summary = () => page.getByRole("textbox", { name: "summary" });
const cells = () => [...document.querySelectorAll("[data-slot=status-bar-cell]")].map((cell) => cell.textContent);

const body = () => page.getByRole("textbox", { name: "본문" });
const handle = () => page.getByRole("button", { name: "블록 메뉴" });

/** Brings out a block's handle: the pointer goes over the block, then to its margin. */
async function handleOf(words: string) {
	const line = body().getByText(words, { exact: true }).element().getBoundingClientRect();
	await pointerPath([
		{ x: line.left + 40, y: line.top + 8 },
		{ x: line.left - 14, y: line.top + 12 },
	]);
	await expect.element(handle()).toBeVisible();
}

/** What went wrong outside the test's own steps: an error thrown in an effect takes the whole admin down. */
function uncaught() {
	const errors: string[] = [];
	const heard = (event: ErrorEvent) => errors.push(event.message);
	window.addEventListener("error", heard);
	onTestFinished(() => window.removeEventListener("error", heard));
	return errors;
}

/**
 * The editor of the first post, published before it opens, with the assistant's proposal for it waiting on the panel's card. `withBody`:
 * the post has a body of two paragraphs (and the proposal changes it, when `change.body`).
 */
async function opened({ withBody = false, change = {} }: { withBody?: boolean; change?: { body?: boolean } } = {}) {
	const story = proposing(change);
	await story.run();
	await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
	const loaded = story.loaded();
	const { monti } = loaded.site;
	if (withBody) {
		const now = (await monti.run("entries.get", { id: loaded.ids.first }, admin)) as { entry: { version: number } };
		await monti.run("entries.save", { id: loaded.ids.first, version: now.entry.version, doc: BODY }, admin);
	}
	await monti.run("entries.publish", { ids: [loaded.ids.first] }, admin);
	window.location.hash = `#/c/post/${loaded.ids.first}`;
	await expect.element(title()).toHaveValue("첫 번째 글");
	// The state in the head; the publish button says it too while there is nothing to publish.
	await expect.element(page.getByText("발행됨", { exact: true }).first()).toBeVisible();
	await userEvent.click(button("어시스턴트 열기"));
	await userEvent.fill(box(), "요약 고쳐 줘");
	await userEvent.keyboard("{Enter}");
	await expect.element(panel().getByRole("button", { name: "1건 적용" })).toBeVisible();
	return loaded;
}

describe("an open editor after a write elsewhere (AS-47)", () => {
	it("02-2 applying a proposal from the panel shows the server's copy in the open editor: the new summary and '수정 중'", async () => {
		await opened();
		await userEvent.click(panel().getByRole("button", { name: "1건 적용" }));
		await expect.element(panel().getByText("✓ 1건 적용")).toBeVisible();
		await expect.element(summary()).toHaveValue(SUMMARY);
		// The value is the saved one now, not a proposal drawn over the field.
		expect(summary().element().hasAttribute("data-proposal")).toBe(false);
		await expect.element(page.getByText("수정 중", { exact: true })).toBeVisible();
		await expect.poll(cells).toContain("저장됨");
	});

	it("02-2 a proposal that changes only a field leaves the body editor as it is, its block handle showing: nothing breaks, and the body takes typing and shows its handle after", async () => {
		const errors = uncaught();
		await opened({ withBody: true });
		await expect.element(body().getByText(FIRST, { exact: true })).toBeVisible();
		const drawn = body().element();
		// The handle out when the change comes: what follows it listens to the text's element.
		await handleOf(FIRST);
		await userEvent.click(panel().getByRole("button", { name: "1건 적용" }));
		await expect.element(panel().getByText("✓ 1건 적용")).toBeVisible();
		await expect.element(summary()).toHaveValue(SUMMARY);
		await expect.element(page.getByText("수정 중", { exact: true })).toBeVisible();
		await expect.element(button("발행하기")).toBeVisible();
		// The same editor: the reads made again after the write brought the same blocks, and the editor is not made again from them.
		expect(body().element()).toBe(drawn);
		await caretAfter(body().element(), "첫 문단");
		await userEvent.keyboard("만");
		await expect.element(body().getByText("탭과 단 사이의 첫 문단만입니다.", { exact: true })).toBeVisible();
		await handleOf(SECOND);
		expect(errors).toEqual([]);
	});

	it("02-2 a proposal that changes the body draws the new body: the editor takes typing and shows its handle", async () => {
		const errors = uncaught();
		await opened({ withBody: true, change: { body: true } });
		await handleOf(FIRST);
		await userEvent.click(panel().getByRole("button", { name: "1건 적용" }));
		await expect.element(panel().getByText("✓ 1건 적용")).toBeVisible();
		await expect.element(body().getByText(NEW_BODY, { exact: true })).toBeVisible();
		expect(body().element().textContent).not.toContain(SECOND);
		await expect.element(summary()).toHaveValue(SUMMARY);
		await expect.element(page.getByText("수정 중", { exact: true })).toBeVisible();
		await caretAfter(body().element(), "바꾼 본문");
		await userEvent.keyboard("만");
		await expect.element(body().getByText("어시스턴트가 바꾼 본문만입니다.", { exact: true })).toBeVisible();
		await handleOf("어시스턴트가 바꾼 본문만입니다.");
		expect(errors).toEqual([]);
	});

	it("02-2 over unsaved typing the applied change does not take the typing away: the conflict banner says it was saved elsewhere, and loading the latest brings it", async () => {
		await opened();
		await userEvent.fill(title(), "고치는 중인 제목");
		await expect.poll(cells).toContain("저장 전 변경사항");
		await userEvent.click(panel().getByRole("button", { name: "1건 적용" }));
		await expect.element(panel().getByText("✓ 1건 적용")).toBeVisible();
		await expect.element(page.getByText(/다른 곳에서 .*먼저 저장했습니다/)).toBeVisible();
		await expect.poll(cells).toContain("편집 충돌");
		await expect.element(title()).toHaveValue("고치는 중인 제목");
		await userEvent.click(button("서버 최신본 불러오기"));
		await expect.element(summary()).toHaveValue(SUMMARY);
		await expect.element(title()).toHaveValue("첫 번째 글");
		await expect.element(page.getByText("수정 중", { exact: true })).toBeVisible();
	});
});
