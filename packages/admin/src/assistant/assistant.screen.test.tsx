import { ProviderError } from "@monti-cms/ai";
import type { ProposalView } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { scene } from "../../test/scene";
import * as stories from "./assistant.stories";

type Loaded = stories.Loaded;
const open = (story: Parameters<typeof scene>[0]) => scene<Loaded>(story, stories.default);
/** A site with what the scripted model says, drawn on the post list with the panel closed. */
const on = (options: Parameters<typeof stories.site>[0]) => open({ loaders: stories.site(options) });

const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const panel = () => page.getByRole("complementary", { name: "어시스턴트" });
const box = () => page.getByRole("textbox", { name: "어시스턴트에게 묻기" });
const focused = () => document.activeElement;
const READ = { calls: [{ name: "entries_query", input: { collection: "post" } }] };

async function openPanel() {
	await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
	await userEvent.click(button("어시스턴트 열기"));
	await expect.element(box()).toBeVisible();
}
async function say(words: string) {
	await userEvent.fill(box(), words);
	await userEvent.keyboard("{Enter}");
}
const summaryOf = async (loaded: Loaded, id: string) =>
	((await loaded.site.monti.run("entries.get", { id }, stories.admin)) as { entry: { values: { summary?: string } } })
		.entry.values.summary ?? null;
const proposalsOf = (loaded: Loaded) =>
	loaded.site.db.selectFrom("monti_proposal").select(["id", "status"]).execute() as Promise<
		{ id: string; status: ProposalView["status"] }[]
	>;

describe("asking (flow 2, 01–03)", () => {
	it("10-1 [flow 2·01] the panel opens with this screen's requests to start from; pressing one asks it, and what was asked is offered again in a new conversation", async () => {
		const story = on({ script: stories.found });
		await story.run();
		await openPanel();
		await expect.element(button("한 달 넘게 안 고친 초안 찾아 줘")).toBeVisible();
		await userEvent.click(button("요약이 비어 있는 글 찾아 줘"));
		await expect.element(panel().getByText("글 목록 읽음 · 3편")).toBeVisible();
		await expect.element(button("셋째 글")).toBeVisible();
		// What went along is on the bubble: this list.
		await expect.element(panel().getByText("이 목록").first()).toBeVisible();
		await userEvent.click(button("새 대화"));
		// Asked before: offered again, beside the screen's own.
		expect(button("요약이 비어 있는 글 찾아 줘").elements().length).toBe(2);
	});

	it("10-1 [flow 2·02] while it works the tool line shows what it reads and the send button is the stop button; stopping leaves what was done", async () => {
		// Its second turn is held, and would read once more.
		const story = on({ script: (_ids, _version, gate) => [READ, { hold: gate, ...READ }] });
		await story.run();
		const { site } = story.loaded();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.element(panel().getByText("글 목록 읽음 · 3편")).toBeVisible();
		await expect.element(button("멈추기")).toBeVisible();
		await expect.element(button("보내기")).not.toBeInTheDocument();
		await userEvent.click(button("멈추기"));
		// The run is told; the scripted model has no call to cut short, so its turn is let go, as a real service's call ends when aborted.
		await expect
			.poll(async () => (await site.db.selectFrom("runs").select("stop_requested").execute())[0]?.stop_requested)
			.toBe(true);
		story.loaded().release();
		await expect.element(button("보내기")).toBeVisible();
		// What it did stays: the read before the stop, and the one its turn was on when told.
		await expect.element(panel().getByText("글 목록 읽음 · 3편").first()).toBeVisible();
		const runs = await story.loaded().site.db.selectFrom("runs").select("status").execute();
		await expect
			.poll(async () => (await story.loaded().site.db.selectFrom("runs").select("status").execute())[0]?.status)
			.toBe("stopped");
		expect(runs).toHaveLength(1);
	});

	it("10-1 Enter sends and Shift+Enter breaks the line; an empty box sends nothing", async () => {
		const story = on({ script: () => [{ text: "네." }] });
		await story.run();
		await openPanel();
		await userEvent.click(box());
		await userEvent.keyboard("{Enter}");
		expect(story.loaded().model.turns).toHaveLength(0);
		await userEvent.keyboard("첫 줄{Shift>}{Enter}{/Shift}둘째 줄");
		await expect.element(box()).toHaveValue("첫 줄\n둘째 줄");
		expect(story.loaded().model.turns).toHaveLength(0);
		await userEvent.keyboard("{Enter}");
		await expect.element(panel().getByText("네.")).toBeVisible();
		await expect.element(box()).toHaveValue("");
	});

	it("10-1 [flow 2·03, 04] an entry the answer names is a link that opens it; the panel stays beside the editor with the conversation, and the open entry goes along next", async () => {
		const story = on({ script: stories.found });
		await story.run();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await userEvent.click(button("둘째 글"));
		await expect.poll(() => window.location.hash).toBe(`#/c/post/${story.loaded().ids.second}`);
		await expect.element(panel().getByText("글 목록 읽음 · 3편")).toBeVisible();
		await expect.element(panel().getByText("이 글", { exact: true })).toBeVisible();
	});

	it("10-1 [flow 2·04] asked to open an entry, the assistant moves the screen to it, and says so in a tool line", async () => {
		const story = on({
			script: (ids) => [{ calls: [{ name: "screen_openEntry", input: { id: ids.first } }] }, { text: "열었습니다." }],
		});
		await story.run();
		await openPanel();
		await say("첫 번째 글 열어 줘");
		await expect.poll(() => window.location.hash).toBe(`#/c/post/${story.loaded().ids.first}`);
		await expect.element(panel().getByText("글 엶")).toBeVisible();
		await expect.element(panel().getByText("열었습니다.")).toBeVisible();
		// The model was told what the screen did.
		const answered = JSON.stringify(story.loaded().model.turns[1]?.messages);
		expect(answered).toContain("첫 번째 글");
	});

	it("10-1 the model's text loads nothing: a picture is its words and address as text, and a link elsewhere is a link that asks for nothing until pressed", async () => {
		const story = on({
			script: () => [
				{
					text: "그림: ![고양이](https://evil.example/cat.png?c=secret)\n\n[바깥 글](https://example.org/a)과 **굵은 말**, `code`, [이상한 것](javascript:alert(1)).",
				},
			],
		});
		await story.run();
		await openPanel();
		await say("보여 줘");
		await expect.element(panel().getByText(/고양이 \(https:\/\/evil\.example\/cat\.png\?c=secret\)/)).toBeVisible();
		expect(panel().element().querySelectorAll("img")).toHaveLength(0);
		const outside = panel().getByRole("link", { name: "바깥 글" }).element() as HTMLAnchorElement;
		expect(outside.target).toBe("_blank");
		expect(outside.rel).toContain("noreferrer");
		// What only looks like a link stays as it was written.
		expect(panel().element().querySelector('a[href^="javascript"]')).toBeNull();
		await expect.element(panel().getByText(/\[이상한 것\]\(javascript:alert\(1\)/)).toBeVisible();
	});
});

describe("the conversation's spacing", () => {
	it("10-1 from a message to what follows it is 36px, with the row of its time and buttons inside that room: showing the row moves nothing", async () => {
		const story = on({ script: stories.scripts(stories.found, () => [{ text: "네." }]) });
		await story.run();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.element(button("셋째 글")).toBeVisible();
		await say("고마워");
		await expect.element(panel().getByText("네.")).toBeVisible();
		const all = (selector: string) => [...panel().element().querySelectorAll<HTMLElement>(selector)];
		const measure = () => {
			const [first, second] = all("[data-slot=chat-message][data-author=user]");
			const [line] = all("[data-slot=tool-call-line]");
			const answers = all("[data-slot=chat-message][data-author=assistant]");
			// The last piece of the first answer: the second entry it names.
			const lastOfFirst = answers
				.filter((each) => each.getBoundingClientRect().top < (second?.getBoundingClientRect().top ?? 0))
				.at(-1);
			if (!first || !second || !line || !lastOfFirst) throw new Error("the conversation is not drawn");
			return {
				questionToAnswer: Math.round(line.getBoundingClientRect().top - first.getBoundingClientRect().bottom),
				answerToQuestion: Math.round(second.getBoundingClientRect().top - lastOfFirst.getBoundingClientRect().bottom),
			};
		};
		const atRest = measure();
		expect(atRest).toEqual({ questionToAnswer: 36, answerToQuestion: 36 });
		await userEvent.hover(panel().getByText("요약이 비어 있는 글 찾아 줘"));
		await expect.element(button("복사").first()).toBeVisible();
		expect(measure()).toEqual(atRest);
	});
});

describe("more said while it works", () => {
	it("10-1 words said while it works wait over the box: edit puts them back in it, cancel drops them, and what waits is asked when the run ends", async () => {
		const story = on({
			script: (_ids, _version, gate) => [READ, { hold: gate, text: "첫 답." }, { text: "둘째 답." }],
		});
		await story.run();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.element(panel().getByText("글 목록 읽음 · 3편")).toBeVisible();
		await say("초안만 봐 줘");
		await say("빼도 되는 말");
		expect(button("지금 보내기").elements()).toHaveLength(2);
		await userEvent.click(button("취소").last());
		expect(button("지금 보내기").elements()).toHaveLength(1);
		await userEvent.click(button("고치기"));
		await expect.element(box()).toHaveValue("초안만 봐 줘");
		// The words are back in the box to be typed on: the caret is there.
		await expect.poll(() => focused()).toBe(box().element());
		await expect.element(button("지금 보내기")).not.toBeInTheDocument();
		// Queued again and left waiting: it is asked once the run is over.
		await userEvent.keyboard("{Enter}");
		await expect.element(button("지금 보내기")).toBeVisible();
		story.loaded().release();
		await expect.element(panel().getByText("둘째 답.")).toBeVisible();
		await expect.element(button("지금 보내기")).not.toBeInTheDocument();
		expect(story.loaded().model.turns).toHaveLength(3);
	});
});

describe("a run that did not finish (flow 2, 06 · 24)", () => {
	it("10-4 [flow 2·06] the answer broke off: it says so, and 'go on' takes the run up where it stopped without doing again what was done", async () => {
		const story = on({
			script: () => [READ, { text: "요약이 비어 있는 글은", breaksOff: true }, { text: "2편입니다." }],
		});
		await story.run();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.element(panel().getByText("연결이 끊겼습니다")).toBeVisible();
		await userEvent.click(button("이어서 하기"));
		await expect.element(panel().getByText("2편입니다.")).toBeVisible();
		await expect.element(panel().getByText("연결이 끊겼습니다")).not.toBeInTheDocument();
		// The words of the answer that was cut gave way to the answer that came.
		await expect.element(panel().getByText("요약이 비어 있는 글은", { exact: true })).not.toBeInTheDocument();
		// One read, asked for once: the third turn went on from its result.
		expect(panel().getByText("글 목록 읽음 · 3편").elements()).toHaveLength(1);
		expect(story.loaded().model.turns).toHaveLength(3);
	});

	it("10-4 a request that reached its time limit is gone on with by the browser: the answer comes to its end and nobody presses anything", async () => {
		const story = on({ limits: { ms: 1 }, script: stories.found });
		await story.run();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.element(button("셋째 글")).toBeVisible();
		await expect.element(button("이어서 하기")).not.toBeInTheDocument();
		// It took more than one request to get there.
		const run = await story.loaded().site.db.selectFrom("runs").select("status").executeTakeFirstOrThrow();
		expect(run.status).toBe("done");
	});

	it("10-1 the run reached its limit of turns: it says so, and goes on past it when told to", async () => {
		const story = on({ limits: { turns: 1 }, script: stories.found });
		await story.run();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.element(panel().getByText("한도에 닿아 멈췄습니다")).toBeVisible();
		await userEvent.click(button("이어서 하기"));
		await expect.element(button("셋째 글")).toBeVisible();
	});

	it("10-1 [flow 2·24] the service refused: what it said stands after the key's name, the key itself nowhere; another model sends the same words again", async () => {
		const story = on({
			script: () => [
				{ fail: new ProviderError("refused", "Your credit balance is too low.") },
				{ text: "이번에는 됐습니다." },
			],
		});
		await story.run();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.element(panel().getByText("서비스가 거절했습니다")).toBeVisible();
		await expect.element(panel().getByText("Anthropic 개인 · Your credit balance is too low.")).toBeVisible();
		expect(document.body.textContent).not.toContain("sk-ant-");
		await userEvent.click(button("다른 모델로 보내기"));
		await userEvent.click(page.getByRole("menuitemradio", { name: /claude-opus-5-5/ }));
		await expect.element(panel().getByText("이번에는 됐습니다.")).toBeVisible();
		expect(story.loaded().model.turns[1]?.model).toBe("claude-opus-5-5");
		expect(panel().getByText("요약이 비어 있는 글 찾아 줘").elements()).toHaveLength(2);
	});

	it("10-1 the service did not answer: it says so with the key's name, and 'try again' sends the same words", async () => {
		const story = on({
			script: () => [{ fail: new ProviderError("unreachable", "fetch failed") }, { text: "됐습니다." }],
		});
		await story.run();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.element(panel().getByText("서비스가 답하지 않습니다")).toBeVisible();
		await userEvent.click(button("다시 시도"));
		await expect.element(panel().getByText("됐습니다.")).toBeVisible();
	});
});

describe("the key and the model (flow 2, 22–23)", () => {
	it("10-1 [flow 2·22] without a key the panel has one step, to the keys screen, and no box to ask in", async () => {
		await open(stories.NoKey).run();
		await expect.element(page.getByText("AI 연결이 없습니다")).toBeVisible();
		await expect.element(page.getByRole("link", { name: "API 키 넣기" })).toHaveAttribute("href", "#/tools/keys");
		await expect.element(box()).not.toBeInTheDocument();
		await expect.element(button("지난 대화")).not.toBeInTheDocument();
	});

	it("10-1 a site without the assistant draws no ✦", async () => {
		await on({ plugin: false }).run();
		await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: "새 post" })).toBeVisible();
		await expect.element(button("어시스턴트 열기")).not.toBeInTheDocument();
	});

	it("10-1 [flow 2·23] the model menu has the models under their key and narrows as one types; a pick is the button's name; thinking is picked for a model that thinks and is not offered for one that does not", async () => {
		const story = on({ script: () => [{ text: "네." }] });
		await story.run();
		await openPanel();
		await expect.element(button("모델 고르기")).toHaveTextContent("claude-sonnet-5-5");
		await expect.element(button("모델 고르기")).toHaveTextContent("생각 보통");
		await userEvent.click(button("모델 고르기"));
		await expect.element(page.getByText("Anthropic 개인")).toBeVisible();
		await userEvent.click(page.getByRole("menuitem", { name: /생각/ }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "높음" }));
		await userEvent.keyboard("{Escape}");
		await expect.element(button("모델 고르기")).toHaveTextContent("생각 높음");

		await userEvent.click(button("모델 고르기"));
		await userEvent.fill(page.getByRole("textbox", { name: "모델 찾기" }), "haiku");
		await expect.element(page.getByRole("menuitemradio", { name: /claude-opus-5-5/ })).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("menuitemradio", { name: /claude-haiku-5-5/ }));
		await expect.element(button("모델 고르기")).toHaveTextContent("claude-haiku-5-5");
		await expect.element(button("모델 고르기")).not.toHaveTextContent("생각");
		await userEvent.click(button("모델 고르기"));
		await expect.element(page.getByRole("menuitem", { name: /생각/ })).not.toBeInTheDocument();
		await userEvent.keyboard("{Escape}");
		// The model picked is the one asked.
		await say("안녕");
		await expect.element(panel().getByText("네.")).toBeVisible();
		expect(story.loaded().model.turns[0]).toMatchObject({ model: "claude-haiku-5-5", thinking: "off" });
	});

	it("10-1 a conversation whose key was removed goes on with a key the site still has", async () => {
		const story = on({ script: () => [{ text: "첫 답." }, { text: "둘째 답." }] });
		await story.run();
		const { site } = story.loaded();
		await openPanel();
		await say("안녕");
		await expect.element(panel().getByText("첫 답.")).toBeVisible();
		const keys = (await site.monti.run("keys.list", {}, stories.admin)) as { keys: { id: string }[] };
		await site.monti.run(
			"keys.add",
			{ service: "anthropic", name: "Anthropic 회사", secret: "sk-ant-api03-another-story-key-77de" },
			stories.admin,
		);
		await site.monti.run("keys.remove", { id: keys.keys[0]?.id }, stories.admin);
		// The panel reads the keys again as it opens.
		await userEvent.click(page.getByRole("button", { name: "닫기" }));
		await userEvent.click(button("어시스턴트 열기"));
		await say("다시");
		await expect.element(panel().getByText("둘째 답.")).toBeVisible();
		await expect.element(page.getByText("그 키에 없는 모델입니다.")).not.toBeInTheDocument();
	});

	it("10-1 by the keyboard: Tab goes from the box to the model button to send; Esc closes the menu and the focus is back on its button; closing the panel hands the focus to ✦", async () => {
		await on({}).run();
		await openPanel();
		await userEvent.click(box());
		await userEvent.keyboard("안녕");
		await userEvent.keyboard("{Tab}");
		expect(focused()).toBe(button("모델 고르기").element());
		await userEvent.keyboard("{Tab}");
		expect(focused()).toBe(button("보내기").element());
		button("모델 고르기").element().focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("textbox", { name: "모델 찾기" })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.poll(() => focused()).toBe(button("모델 고르기").element());
		await userEvent.click(page.getByRole("button", { name: "닫기" }));
		await expect.poll(() => focused()).toBe(button("어시스턴트 열기").element());
	});
});

describe("past conversations (flow 2, 25–26)", () => {
	it("10-1 [flow 2·25, 26] past conversations say what was asked first and what came of it; one opens as it was; deleting is not asked about; the days are saved as picked", async () => {
		const story = on({ script: stories.scripts(stories.found, stories.proposed) });
		await story.run();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.element(button("셋째 글")).toBeVisible();
		await userEvent.click(button("새 대화"));
		await say("둘 다 요약 채워 줘");
		await expect.element(button("2건 적용")).toBeVisible();

		await userEvent.click(button("지난 대화"));
		const past = page.getByRole("complementary", { name: "지난 대화" });
		await expect.element(past.getByText(/검토 대기/)).toBeVisible();
		expect(past.getByRole("row").elements()).toHaveLength(2);
		// The one open now is the picked row.
		expect(
			past
				.getByRole("row", { name: /둘 다 요약 채워 줘/ })
				.element()
				.getAttribute("data-selected"),
		).not.toBeNull();
		await userEvent.click(past.getByRole("button", { name: "요약이 비어 있는 글 찾아 줘", exact: true }));
		await expect.element(panel().getByText("글 목록 읽음 · 3편")).toBeVisible();
		await expect.element(button("셋째 글")).toBeVisible();

		await userEvent.click(button("지난 대화"));
		await userEvent.click(button("둘 다 요약 채워 줘 더 보기"));
		await userEvent.click(page.getByRole("menuitem", { name: "지우기" }));
		await expect.element(past.getByText("둘 다 요약 채워 줘")).not.toBeInTheDocument();
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
		// Its waiting proposal went with it.
		await expect.poll(async () => (await proposalsOf(story.loaded())).length).toBe(0);

		await userEvent.click(past.getByRole("combobox", { name: "안 연 대화 지우기" }));
		await userEvent.click(page.getByRole("option", { name: "90일 뒤" }));
		await expect
			.poll(
				async () =>
					((await story.loaded().site.monti.run("assistant.state", {}, stories.admin)) as { keepDays: number })
						.keepDays,
			)
			.toBe(90);
		await userEvent.click(button("대화로 돌아가기"));
		await userEvent.click(button("지난 대화"));
		await expect.element(past.getByRole("combobox", { name: "안 연 대화 지우기" })).toHaveTextContent("90일 뒤");
	});

	it("10-1 no past conversations: one line says so", async () => {
		await open(stories.NoPastConversations).run();
		await expect.element(page.getByText("지난 대화가 없습니다")).toBeVisible();
	});

	it("10-1 the panel stays open, on its conversation, as the screen changes", async () => {
		const story = on({ script: stories.found });
		await story.run();
		await openPanel();
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.element(button("셋째 글")).toBeVisible();
		await userEvent.click(page.getByRole("navigation").getByText("memo"));
		await expect.element(page.getByRole("heading", { name: "memo" })).toBeVisible();
		await expect.element(button("셋째 글")).toBeVisible();
		// And the browser keeps that it was open, and on which conversation, for the next visit.
		const kept = JSON.parse(localStorage.getItem("monti.assistant") ?? "{}") as { open: boolean; conversation: string };
		expect(kept.open).toBe(true);
		expect(kept.conversation).toBeTruthy();
	});
});

describe("a proposal in the conversation (flow 2, 11 · 16)", () => {
	it("10-3 what the assistant would change is not changed until a person applies it", async () => {
		const story = on({ script: stories.proposed });
		await story.run();
		await openPanel();
		await say("둘 다 요약 채워 줘");
		await expect.element(button("2건 적용")).toBeVisible();
		await expect.element(panel().getByText("요약 채우기 · 2건")).toBeVisible();
		const loaded = story.loaded();
		expect(await summaryOf(loaded, loaded.ids.second)).toBeNull();
		expect(await summaryOf(loaded, loaded.ids.third)).toBeNull();
	});

	it("10-1 [flow 2·11, 16] applying from the card says how many were applied; undoing puts the entries back and the card says so", async () => {
		const story = on({ script: stories.proposed });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("둘 다 요약 채워 줘");
		await userEvent.click(button("2건 적용"));
		await expect.element(panel().getByText("✓ 2건 적용")).toBeVisible();
		expect(await summaryOf(loaded, loaded.ids.second)).toBe(
			"둘째 글은 관리자 화면을 처음 여는 사람을 위한 안내입니다.",
		);
		await userEvent.click(button("되돌리기"));
		await expect.element(panel().getByText("되돌림", { exact: true })).toBeVisible();
		expect(await summaryOf(loaded, loaded.ids.second)).toBeNull();
		expect(await summaryOf(loaded, loaded.ids.third)).toBeNull();
	});

	it("10-1 discarding leaves the entries as they were, and the card says it was discarded", async () => {
		const story = on({ script: stories.proposed });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("둘 다 요약 채워 줘");
		await userEvent.click(button("버리기"));
		await expect.element(panel().getByText("버림", { exact: true })).toBeVisible();
		await expect.element(button("2건 적용")).not.toBeInTheDocument();
		expect(await summaryOf(loaded, loaded.ids.second)).toBeNull();
		expect((await proposalsOf(loaded))[0]?.status).toBe("discarded");
	});
});

describe("the review page (flow 2, 12–15)", () => {
	async function toReview(story: ReturnType<typeof on>) {
		await story.run();
		await openPanel();
		await say("요약 채우고 제목도 다듬어 줘");
		await userEvent.click(button("검토"));
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		// The title's change, once the entry it is of was read: the words it puts in.
		await expect.element(page.getByRole("main").getByText("글, 다시")).toBeVisible();
	}

	it("10-1 [flow 2·12] each kind of change is a titled list with a check on every change; a check taken out is counted out of the pill, here and on the card; a whole kind is left out at once", async () => {
		const story = on({ script: stories.proposedKinds });
		await toReview(story);
		await expect.element(page.getByText("“요약 채우고 제목도 다듬어 줘”")).toBeVisible();
		await expect.element(page.getByRole("heading", { name: /요약 채우기/ })).toBeVisible();
		await expect.element(page.getByRole("heading", { name: /제목 다듬기/ })).toBeVisible();
		await expect.element(page.getByRole("button", { name: "3건 적용" }).first()).toBeVisible();
		await userEvent.click(page.getByRole("checkbox", { name: "첫 번째 글 넣기" }));
		await expect.element(page.getByRole("button", { name: "2건 적용" }).first()).toBeVisible();
		// The card in the conversation reads the same proposal.
		await expect.element(panel().getByRole("button", { name: "2건 적용" })).toBeVisible();
		await userEvent.click(button("2건 모두 빼기"));
		const pill = page.getByRole("button", { name: "0건 적용" }).first();
		await expect.element(pill).toBeDisabled();
		await userEvent.click(button("2건 모두 넣기"));
		await expect.element(page.getByRole("button", { name: "2건 적용" }).first()).toBeVisible();
	});

	it("10-1 [flow 2·13] a change of words reads on one line with what goes out and comes in, or side by side as it is and as proposed", async () => {
		const story = on({ script: stories.proposedKinds });
		await toReview(story);
		const main = page.getByRole("main");
		// On one line: the title as it is, with ", 다시" put in.
		expect(main.element().querySelectorAll("ins").length).toBeGreaterThan(0);
		await userEvent.click(page.getByRole("tab", { name: "나란히" }).first());
		const sides = main.element().querySelectorAll("[data-slot=compare-row]");
		expect([...sides].some((row) => row.children.length === 3)).toBe(true);
		await userEvent.click(page.getByRole("tab", { name: "한 줄" }).first());
		expect(
			[...main.element().querySelectorAll("[data-slot=compare-row]")].every((row) => row.children.length === 2),
		).toBe(true);
	});

	it("10-1 [flow 2·14, 15] applying from the page shows each change's result and what was not kept in is not applied; undoing puts everything back", async () => {
		const story = on({ script: stories.proposedKinds });
		await toReview(story);
		const loaded = story.loaded();
		await userEvent.click(page.getByRole("checkbox", { name: "첫 번째 글 넣기" }));
		await userEvent.click(page.getByRole("button", { name: "2건 적용" }).first());
		await expect.element(page.getByText("✓ 2건 적용").first()).toBeVisible();
		expect(page.getByRole("main").getByText("적용", { exact: true }).elements()).toHaveLength(2);
		expect(await summaryOf(loaded, loaded.ids.third)).toBe("셋째 글은 배포한 뒤에 확인할 것을 정리합니다.");
		const first = (await loaded.site.monti.run("entries.get", { id: loaded.ids.first }, stories.admin)) as {
			entry: { title: string };
		};
		expect(first.entry.title).toBe("첫 번째 글");
		// Once applied the checks no longer change.
		await expect.element(page.getByRole("checkbox", { name: "둘째 글 넣기" })).toHaveAttribute("aria-readonly", "true");
		await userEvent.click(page.getByRole("button", { name: "되돌리기" }).first());
		await expect.element(page.getByRole("main").getByText("되돌림").first()).toBeVisible();
		expect(await summaryOf(loaded, loaded.ids.third)).toBeNull();
	});

	it("10-1 a change whose entry was edited meanwhile says so and is out of the count; made again, it is a change of the entry as it is now", async () => {
		const story = on({
			script: stories.scripts(stories.proposed, async (ids, version) => [
				{
					calls: [
						{
							name: "entries_save",
							// The version is read when this turn is asked for: after the entry was edited elsewhere.
							input: {
								id: ids.third,
								version: (await version(ids.third)) + 1,
								values: { summary: "다시 쓴 요약입니다." },
								_group: "요약 채우기",
							},
						},
					],
				},
				{ text: "다시 만들었습니다." },
			]),
		});
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("둘 다 요약 채워 줘");
		await expect.element(button("2건 적용")).toBeVisible();
		const now = (await loaded.site.monti.run("entries.get", { id: loaded.ids.third }, stories.admin)) as {
			entry: { version: number };
		};
		await loaded.site.monti.run(
			"entries.save",
			{ id: loaded.ids.third, version: now.entry.version, title: "셋째 글, 고침" },
			stories.admin,
		);
		const [proposal] = await proposalsOf(loaded);
		window.location.hash = `#/ai/review/${proposal?.id}`;
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		await expect.element(page.getByText("그 사이 고쳐짐")).toBeVisible();
		await expect.element(page.getByRole("button", { name: "1건 적용" }).first()).toBeVisible();
		await userEvent.click(button("다시 만들기"));
		await expect.element(page.getByText("다시 쓴 요약입니다.").first()).toBeVisible();
		await expect.element(page.getByText("그 사이 고쳐짐")).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "2건 적용" }).first()).toBeVisible();
	});

	it("10-1 '‹ 어시스턴트' goes back to where the person came from, with the panel on the proposal's conversation", async () => {
		const story = on({ script: stories.proposedKinds });
		await toReview(story);
		await userEvent.click(page.getByRole("button", { name: "닫기" }));
		await userEvent.click(button("‹ 어시스턴트"));
		await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
		await expect.element(panel().getByRole("button", { name: "3건 적용" })).toBeVisible();
	});
});
