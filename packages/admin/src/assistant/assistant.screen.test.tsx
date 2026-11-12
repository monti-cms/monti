import { ProviderError } from "@monti-cms/ai";
import type { ProposalView } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { holdKey, pressTwice, releaseKey } from "../../../../testing/input";
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
		// It says so, with the model that is used from now on.
		await expect.element(page.getByText(/^쓰던 모델이 없어졌습니다\. 지금 모델: claude-/)).toBeVisible();
		await say("다시");
		await expect.element(panel().getByText("둘째 답.")).toBeVisible();
		await expect.element(page.getByText("그 키에 없는 모델입니다.")).not.toBeInTheDocument();
	});

	it("10-1 a key removed while the panel is open: the request that is refused for its model reads the models again, the panel says which model is used now, and the same words go with it", async () => {
		const story = on({ script: () => [{ text: "첫 답." }, { text: "둘째 답." }] });
		await story.run();
		const { site, model } = story.loaded();
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
		await say("다시");
		await expect.element(page.getByText(/^쓰던 모델이 없어졌습니다\. 지금 모델: claude-/)).toBeVisible();
		// The turn that never began says why in the server's words, once, in the conversation: not that a connection was lost.
		expect(panel().getByText("그 키에 없는 모델입니다.").elements()).toHaveLength(1);
		expect(page.getByText("그 키에 없는 모델입니다.").elements()).toHaveLength(1);
		expect(panel().getByText("연결이 끊겼습니다").elements()).toHaveLength(0);
		expect(model.turns).toHaveLength(1);
		await userEvent.click(button("다시 시도"));
		await expect.element(panel().getByText("둘째 답.")).toBeVisible();
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
		// A person reads that it was applied first: a press in the moment "undo" appears is not taken.
		await new Promise((resolve) => setTimeout(resolve, 500));
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
		// A press in the moment "undo" appears is not taken (it may have been meant for "apply"): a person reads the result first.
		await new Promise((resolve) => setTimeout(resolve, 500));
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

describe("which run and which conversation the page follows (the first review of #480)", () => {
	const gate = () => {
		let open = () => {};
		const wait = new Promise<void>((resolve) => {
			open = resolve;
		});
		return { wait, open };
	};
	const beat = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
	const runsOf = (loaded: Loaded) =>
		loaded.site.db
			.selectFrom("runs")
			.select(["id", "status", "conversation_id", "request", "stop_requested"])
			.execute();
	const runOf = async (loaded: Loaded, request: string) =>
		(await runsOf(loaded)).find((run) => run.request === request);
	const past = () => page.getByRole("complementary", { name: "지난 대화" });
	const going = () => panel().element().querySelectorAll("[aria-busy=true]").length;
	const calls = (loaded: Loaded, name: string) => loaded.net.sent.filter((each) => each.name === name);

	it("10-1 '새 대화' while a run works: the run left behind goes on to its end and changes nothing in the new conversation, where what waits is asked after its own run", async () => {
		const first = gate();
		const second = gate();
		const story = on({
			script: () => [
				{ hold: first.wait, text: "첫 대화의 답." },
				{ hold: second.wait, text: "둘째 대화의 답." },
				{ text: "셋째 답." },
			],
		});
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("첫 질문");
		await expect.poll(() => loaded.model.turns.length).toBe(1);
		await userEvent.click(button("새 대화"));
		await say("둘째 질문");
		await expect.poll(() => loaded.model.turns.length).toBe(2);
		await say("셋째 질문");
		await expect.element(button("지금 보내기")).toBeVisible();

		// The first conversation's run ends while the second's works: it is not this conversation's end.
		first.open();
		await expect.poll(async () => (await runOf(loaded, "첫 질문"))?.status).toBe("done");
		await beat();
		expect(loaded.model.turns).toHaveLength(2);
		await expect.element(button("지금 보내기")).toBeVisible();
		await expect.element(button("멈추기")).toBeVisible();
		await expect.element(panel().getByText("첫 대화의 답.")).not.toBeInTheDocument();
		expect((await runOf(loaded, "둘째 질문"))?.status).toBe("running");

		second.open();
		await expect.element(panel().getByText("셋째 답.")).toBeVisible();
		const all = await runsOf(loaded);
		expect(all.map((run) => run.status)).toEqual(["done", "done", "done"]);
		const conversation = (request: string) => all.find((run) => run.request === request)?.conversation_id;
		expect(conversation("셋째 질문")).toBe(conversation("둘째 질문"));
		expect(conversation("첫 질문")).not.toBe(conversation("둘째 질문"));
	});

	it("10-1 '새 대화' before the run has said its id: the run that then begins does not pull the panel back into its conversation", async () => {
		const story = on({ script: () => [{ text: "첫 답." }, { text: "둘째 답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		const begin = loaded.net.hold("assistant.run");
		await say("첫 질문");
		await userEvent.click(button("새 대화"));
		begin();
		await expect.poll(async () => (await runOf(loaded, "첫 질문"))?.status).toBe("done");
		await beat();
		await expect.element(panel().getByText("첫 답.")).not.toBeInTheDocument();
		await say("둘째 질문");
		await expect.element(panel().getByText("둘째 답.")).toBeVisible();
		const [one, two] = [await runOf(loaded, "첫 질문"), await runOf(loaded, "둘째 질문")];
		expect(two?.conversation_id).not.toBe(one?.conversation_id);
		expect((JSON.parse(localStorage.getItem("monti.assistant") ?? "{}") as { conversation: string }).conversation).toBe(
			two?.conversation_id,
		);
	});

	it("10-1 a past conversation opened while a run works: pressing the one that is open changes nothing; opening another lets the run go on to its end, and it is there when opened again", async () => {
		const long = gate();
		const story = on({
			script: () => [{ text: "옛 답." }, { hold: long.wait, text: "긴 답의 앞." }, { text: "기다린 말의 답." }],
		});
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("옛 질문");
		await expect.element(panel().getByText("옛 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await userEvent.click(button("새 대화"));
		await say("긴 질문");
		await expect.poll(() => loaded.model.turns.length).toBe(2);
		await say("기다리는 말");

		// The conversation that is open, pressed in the list: its run, and what waits behind it, are as they were.
		await userEvent.click(button("지난 대화"));
		await userEvent.click(past().getByRole("button", { name: "긴 질문", exact: true }));
		await expect.element(button("멈추기")).toBeVisible();
		await expect.element(button("지금 보내기")).toBeVisible();
		await beat();
		expect((await runOf(loaded, "긴 질문"))?.status).toBe("running");

		// Another one opened: the run is not cut.
		await userEvent.click(button("지난 대화"));
		await userEvent.click(past().getByRole("button", { name: "옛 질문", exact: true }));
		await expect.element(panel().getByText("옛 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await beat();
		expect((await runOf(loaded, "긴 질문"))?.status).toBe("running");
		long.open();
		await expect.poll(async () => (await runOf(loaded, "긴 질문"))?.status).toBe("done");
		await beat();
		// Its end is not shown here, and the words that waited behind it went with it: nothing is asked in this conversation.
		await expect.element(panel().getByText("긴 답의 앞.")).not.toBeInTheDocument();
		expect(loaded.model.turns).toHaveLength(2);

		await userEvent.click(button("지난 대화"));
		await userEvent.click(past().getByRole("button", { name: "긴 질문", exact: true }));
		await expect.element(panel().getByText("긴 답의 앞.")).toBeVisible();
		await expect.element(panel().getByText("연결이 끊겼습니다")).not.toBeInTheDocument();
	});

	it("10-1 '‹ 어시스턴트' on the review page while the run works: the run goes on, and what waits behind it is asked when it ends", async () => {
		const more = gate();
		const story = on({
			script: async (ids, version, held) => {
				const [writes] = await stories.proposedKinds(ids, version, held);
				return [writes, { hold: more.wait, text: "제안했습니다." }, { text: "기다린 말의 답." }];
			},
		});
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("요약 채우고 제목도 다듬어 줘");
		await expect.element(button("검토")).toBeVisible();
		await say("기다리는 말");
		await expect.element(button("지금 보내기")).toBeVisible();
		await userEvent.click(button("검토"));
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		await userEvent.click(button("‹ 어시스턴트"));
		await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
		await beat();
		await expect.element(button("멈추기")).toBeVisible();
		await expect.element(button("지금 보내기")).toBeVisible();
		await expect.element(panel().getByText("연결이 끊겼습니다")).not.toBeInTheDocument();
		expect((await runOf(loaded, "요약 채우고 제목도 다듬어 줘"))?.status).toBe("running");
		more.open();
		await expect.element(panel().getByText("기다린 말의 답.")).toBeVisible();
		expect((await runsOf(loaded)).map((run) => run.status)).toEqual(["done", "done"]);
	});

	it("10-1 a conversation's read that comes back after another was opened is not shown", async () => {
		const story = on({ script: () => [{ text: "옛 답." }, { text: "새 답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("옛 질문");
		await expect.element(panel().getByText("옛 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await userEvent.click(button("새 대화"));
		await say("새 질문");
		await expect.element(panel().getByText("새 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await userEvent.click(button("지난 대화"));
		// The old one is asked for, and before its answer is here the person goes back to the new one.
		const read = loaded.net.hold("conversations.get", 0);
		await userEvent.click(past().getByRole("button", { name: "옛 질문", exact: true }));
		// Its requests are not here yet, and neither are the ones of the conversation that was open, nor the requests to start from.
		await beat();
		expect(panel().getByText("새 답.").elements()).toHaveLength(0);
		expect(button("한 달 넘게 안 고친 초안 찾아 줘").elements()).toHaveLength(0);
		await userEvent.click(button("지난 대화"));
		await userEvent.click(past().getByRole("button", { name: "새 질문", exact: true }));
		read();
		await expect.element(panel().getByText("새 답.")).toBeVisible();
		await beat();
		await expect.element(panel().getByText("옛 답.")).not.toBeInTheDocument();
	});

	it("10-1 a request made while the conversation that was opened is still being read stays, under what the read brings", async () => {
		const story = on({ script: () => [{ text: "옛 답." }, { text: "새 답." }, { text: "읽는 동안 물은 답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("옛 질문");
		await expect.element(panel().getByText("옛 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await userEvent.click(button("새 대화"));
		await say("새 질문");
		await expect.element(panel().getByText("새 답.")).toBeVisible();
		await userEvent.click(button("지난 대화"));
		// The read is answered by the server at once, and its answer is a while coming: what it says is from before the request.
		const read = loaded.net.late("conversations.get");
		await userEvent.click(past().getByRole("button", { name: "옛 질문", exact: true }));
		await say("읽는 동안 물은 말");
		await expect.element(panel().getByText("읽는 동안 물은 답.")).toBeVisible();
		read();
		await expect.element(panel().getByText("옛 답.")).toBeVisible();
		await beat();
		await expect.element(panel().getByText("읽는 동안 물은 말")).toBeVisible();
		await expect.element(panel().getByText("읽는 동안 물은 답.")).toBeVisible();
		// It was asked in the conversation that was opened, after its earlier request.
		const [old, during] = [await runOf(loaded, "옛 질문"), await runOf(loaded, "읽는 동안 물은 말")];
		expect(during?.conversation_id).toBe(old?.conversation_id);
		const said = panel().element().textContent ?? "";
		expect(said.indexOf("옛 질문")).toBeGreaterThan(-1);
		expect(said.indexOf("옛 질문")).toBeLessThan(said.indexOf("읽는 동안 물은 말"));
	});

	it("10-1 stopped while the screen does what the assistant asked: the run is not gone on with, the screen does not move, and nothing is said of a run that ended", async () => {
		const story = on({
			script: (ids) => [{ calls: [{ name: "screen_openEntry", input: { id: ids.second } }] }, { text: "열었습니다." }],
		});
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		// The screen's part takes a while: the entry it opens is being read.
		const opened = loaded.net.hold("entries.get");
		await say("둘째 글 열어 줘");
		await expect.poll(async () => (await runOf(loaded, "둘째 글 열어 줘"))?.status).toBe("waiting");
		await userEvent.click(button("멈추기"));
		await expect.poll(async () => (await runOf(loaded, "둘째 글 열어 줘"))?.status).toBe("stopped");
		opened();
		await beat(500);
		await expect.element(button("보내기")).toBeVisible();
		expect(going()).toBe(0);
		// Looked at once, now: a toast that came and went would be gone by itself in a few seconds.
		expect(page.getByText("끝난 실행입니다.").elements()).toHaveLength(0);
		expect(panel().getByText("연결이 끊겼습니다").elements()).toHaveLength(0);
		await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
		expect(loaded.model.turns).toHaveLength(1);
		expect(calls(loaded, "assistant.run")).toHaveLength(1);
		expect((await runOf(loaded, "둘째 글 열어 줘"))?.status).toBe("stopped");
	});

	it("10-4 stopped just as one request's time was up: the request the browser had already made to go on is told to stop, and the run goes no further", async () => {
		const more = gate();
		const story = on({
			limits: { ms: 1 },
			script: () => [READ, { hold: more.wait, ...READ }, { text: "끝까지 간 답." }],
		});
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		// The first request goes through; the one the browser makes by itself when its time is up is on its way for a while.
		const onward = loaded.net.hold("assistant.run", 1);
		await say("요약이 비어 있는 글 찾아 줘");
		await expect.poll(async () => (await runsOf(loaded))[0]?.status).toBe("interrupted");
		await expect.poll(() => calls(loaded, "assistant.run").length).toBe(2);
		await userEvent.click(button("멈추기"));
		await expect.poll(() => calls(loaded, "assistant.stop").length).toBe(1);
		onward();
		await beat(600);
		more.open();
		await expect.element(button("보내기")).toBeVisible();
		await beat();
		// It did not go on to its end: at most the turn it was taken up into, which was told to stop.
		await expect.element(panel().getByText("끝까지 간 답.")).not.toBeInTheDocument();
		expect(loaded.model.turns.length).toBeLessThanOrEqual(2);
		expect(["stopped", "interrupted"]).toContain((await runsOf(loaded))[0]?.status);
		expect(going()).toBe(0);
		await expect.element(button("이어서 하기")).not.toBeInTheDocument();
	});

	it("10-1 stopped before the run has said its id: the run is told to stop when it does, and ends as stopped", async () => {
		const more = gate();
		const story = on({ script: () => [{ hold: more.wait, text: "답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		const begin = loaded.net.hold("assistant.run");
		await say("첫 질문");
		await userEvent.click(button("멈추기"));
		begin();
		await expect.poll(async () => (await runsOf(loaded))[0]?.stop_requested).toBe(true);
		more.open();
		await expect.poll(async () => (await runsOf(loaded))[0]?.status).toBe("stopped");
		await expect.element(button("보내기")).toBeVisible();
		expect(await runsOf(loaded)).toHaveLength(1);
	});

	it("10-4 the connection went and the run ended in the server meanwhile: what waited behind it is asked, as when its end is heard", async () => {
		const more = gate();
		const story = on({ script: () => [{ hold: more.wait, text: "첫 답." }, { text: "둘째 답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("첫 질문");
		await expect.poll(() => loaded.model.turns.length).toBe(1);
		await say("기다리는 말");
		await expect.element(button("지금 보내기")).toBeVisible();
		loaded.net.cut();
		more.open();
		await expect.element(panel().getByText("둘째 답."), { timeout: 15_000 }).toBeVisible();
		await expect.element(button("지금 보내기")).not.toBeInTheDocument();
		expect((await runsOf(loaded)).map((run) => run.status)).toEqual(["done", "done"]);
	});

	it("10-1 at the top of a long conversation the requests before are read once, however often the thread says it is at its top", async () => {
		const story = on({ script: () => Array.from({ length: 35 }, (_, index) => ({ text: `답 ${index + 1}` })) });
		await story.run();
		const loaded = story.loaded();
		let conversation: string | undefined;
		for (let index = 1; index <= 35; index += 1)
			for await (const event of loaded.site.monti.stream(
				"assistant.run",
				{ ...(conversation ? { conversation } : {}), request: `질문 ${index}` },
				{ actor: "admin", session: null, signal: new AbortController().signal },
			)) {
				const told = event as { type: string; conversationId?: string };
				if (told.type === "run") conversation = told.conversationId;
			}
		await openPanel();
		await userEvent.click(button("지난 대화"));
		await userEvent.click(past().getByRole("button", { name: "질문 1", exact: true }));
		await expect.element(panel().getByText("답 35", { exact: true })).toBeVisible();
		await expect.element(panel().getByText("질문 5", { exact: true })).not.toBeInTheDocument();

		const thread = document.querySelector("[data-slot=chat-thread]") as HTMLElement;
		const earlier = () =>
			calls(loaded, "conversations.get").filter((each) => (each.input as { before?: unknown }).before);
		const read = loaded.net.hold("conversations.get");
		// The browser's own scrolling to the top, several times while the read is on its way (no device: the thread's position is set).
		// The thread is laid out from its foot: its top is as far up as it scrolls.
		const top = thread.clientHeight - thread.scrollHeight;
		let scrolls = 0;
		thread.addEventListener("scroll", () => {
			scrolls += 1;
		});
		for (const nudge of [0, 1, 0, 1, 0]) {
			thread.scrollTop = top + nudge;
			await beat(50);
		}
		expect(scrolls).toBeGreaterThan(2);
		expect(earlier().length).toBe(1);
		read();
		await expect.element(panel().getByText("질문 1", { exact: true })).toBeVisible();
		await beat();
		expect(earlier().length).toBe(1);
		expect(panel().getByText("질문 3", { exact: true }).elements()).toHaveLength(1);
	});

	it("10-1 the admin goes while a run works (the session ended): the request it listened to is ended, and nothing waits to be asked", async () => {
		const more = gate();
		const story = on({ script: () => [{ hold: more.wait, text: "답." }, { text: "묻지 않을 답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("첫 질문");
		await expect.poll(() => loaded.model.turns.length).toBe(1);
		await say("기다리는 말");
		loaded.net.leave();
		await expect.poll(() => calls(loaded, "assistant.run")[0]?.signal?.aborted).toBe(true);
		// The scripted model has no call to cut short: its turn is let go and the run ends in the server, with nobody to ask what waited.
		more.open();
		await expect.poll(async () => (await runsOf(loaded))[0]?.status).not.toBe("running");
		await beat();
		expect(loaded.model.turns).toHaveLength(1);
	});

	it("10-1 of two waiting messages with the same words, edit and cancel act on the one that was pressed", async () => {
		const story = on({ script: (_ids, _version, held) => [{ hold: held, text: "답." }] });
		await story.run();
		await openPanel();
		await say("첫 질문");
		await expect.poll(() => story.loaded().model.turns.length).toBe(1);
		for (const words of ["같은 말", "가운데 말", "같은 말"]) await say(words);
		const waiting = () =>
			[...panel().element().querySelectorAll("[data-slot=chat-queue-item]")].map((each) => each.textContent ?? "");
		expect(waiting()).toHaveLength(3);
		await userEvent.click(button("취소").last());
		expect(waiting().map((words) => words.includes("가운데 말"))).toEqual([false, true]);
		await userEvent.click(button("고치기").first());
		await expect.element(box()).toHaveValue("같은 말");
		expect(waiting()).toHaveLength(1);
		expect(waiting()[0]).toContain("가운데 말");
	});
});

describe("what goes along from each screen (doc 10, context)", () => {
	const SCREENS = [
		{ name: "the list", at: () => null, chip: "이 목록", kind: "list" },
		{ name: "the editor", at: (ids: Loaded["ids"]) => `#/c/post/${ids.second}`, chip: "이 글", kind: "entry" },
		{ name: "the media library", at: () => "#/media", chip: "미디어", kind: "media" },
		{ name: "the settings", at: () => "#/settings/collections", chip: "설정", kind: "settings" },
	];
	for (const screen of SCREENS)
		it(`10-1 on ${screen.name} the screen is a chip over the box and goes along with what is asked; taken off, nothing of the screen goes`, async () => {
			const story = on({ script: () => [{ text: "첫 답." }, { text: "둘째 답." }] });
			await story.run();
			const { model, ids } = story.loaded();
			await openPanel();
			const at = screen.at(ids);
			if (at) window.location.hash = at;
			const off = button(`${screen.chip} 빼기`);
			await expect.element(off).toBeVisible();
			// The library's own request to start from.
			if (screen.kind === "media") await expect.element(button("쓰지 않는 파일 찾아 줘")).toBeVisible();
			await say("첫 질문");
			await expect.element(panel().getByText("첫 답.")).toBeVisible();
			await expect.element(button("보내기")).toBeVisible();
			const asked = (turn: number) => JSON.stringify(model.turns[turn]?.messages.at(-1)).replaceAll('\\"', '"');
			expect(asked(0)).toContain(`"screen":"${screen.kind}"`);
			await userEvent.click(off);
			await expect.element(off).not.toBeInTheDocument();
			await say("둘째 질문");
			await expect.element(panel().getByText("둘째 답.")).toBeVisible();
			expect(asked(1)).toContain("둘째 질문");
			expect(asked(1)).not.toContain("<screen");
		});
});

describe("what the second review of #480 found", () => {
	const gate = () => {
		let open = () => {};
		const wait = new Promise<void>((resolve) => {
			open = resolve;
		});
		return { wait, open };
	};
	const beat = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
	const runsOf = (loaded: Loaded) =>
		loaded.site.db.selectFrom("runs").select(["id", "status", "conversation_id", "request"]).execute();
	const runOf = async (loaded: Loaded, request: string) =>
		(await runsOf(loaded)).find((run) => run.request === request);
	const past = () => page.getByRole("complementary", { name: "지난 대화" });
	const going = () => panel().element().querySelectorAll("[aria-busy=true]").length;
	const told = (loaded: Loaded, turn: number) =>
		JSON.stringify(loaded.model.turns[turn]?.messages).replaceAll('\\"', '"');

	it("10-4 the network goes while a run works: the panel does not stay on working; it says the connection was lost, and going on reads where the run is", async () => {
		const more = gate();
		const story = on({ script: () => [{ hold: more.wait, text: "끊긴 사이에 끝난 답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("첫 질문");
		await expect.poll(() => loaded.model.turns.length).toBe(1);
		// Nothing gets through any more: the stream breaks, and the read that follows it gets no answer.
		const back = loaded.net.lose("conversations.get");
		loaded.net.cut();
		await expect.element(panel().getByText("연결이 끊겼습니다")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		expect(going()).toBe(0);
		// The network is back and the run has ended in the server meanwhile: going on shows it as it ended.
		back();
		more.open();
		await expect.poll(async () => (await runOf(loaded, "첫 질문"))?.status).toBe("done");
		await userEvent.click(button("이어서 하기"));
		await expect.element(panel().getByText("연결이 끊겼습니다")).not.toBeInTheDocument();
		await expect.element(panel().getByText("끊긴 사이에 끝난 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
	});

	it("10-1 asked to show a list while the open entry has unsaved changes, the screen does not move, and the assistant is told why", async () => {
		const story = on({
			script: () => [
				{ calls: [{ name: "list_show", input: { collection: "post", query: { filters: [] } } }] },
				{ text: "저장 전 변경이 있어 옮기지 않았습니다." },
			],
		});
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		window.location.hash = `#/c/post/${loaded.ids.second}`;
		const title = page.getByRole("textbox", { name: "제목" });
		await expect.element(title).toHaveValue("둘째 글");
		await userEvent.fill(title, "둘째 글, 고치는 중");
		await say("글 목록 보여 줘");
		await expect.element(panel().getByText("저장 전 변경이 있어 옮기지 않았습니다.")).toBeVisible();
		expect(window.location.hash).toBe(`#/c/post/${loaded.ids.second}`);
		await expect.element(title).toHaveValue("둘째 글, 고치는 중");
		expect(told(loaded, 1)).toContain("unsaved changes");
	});

	it("10-1 a run found waiting on a screen when its conversation is opened again goes on without moving the screen: what was asked long ago is answered as not done", async () => {
		const story = on({
			script: (ids) => [
				{ calls: [{ name: "screen_openEntry", input: { id: ids.second } }] },
				{ text: "화면은 그대로 두었습니다." },
			],
		});
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		// The screen's part takes a while, and the person goes to a new conversation before it is done.
		const opened = loaded.net.hold("entries.get");
		await say("둘째 글 열어 줘");
		await expect.poll(async () => (await runOf(loaded, "둘째 글 열어 줘"))?.status).toBe("waiting");
		await userEvent.click(button("새 대화"));
		opened();
		await beat();
		await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
		expect((await runOf(loaded, "둘째 글 열어 줘"))?.status).toBe("waiting");

		// Opened again, later: the run goes on, and nothing moves under the person.
		await userEvent.click(button("지난 대화"));
		await userEvent.click(past().getByRole("button", { name: "둘째 글 열어 줘", exact: true }));
		await expect.element(panel().getByText("화면은 그대로 두었습니다."), { timeout: 15_000 }).toBeVisible();
		await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
		expect(window.location.hash.startsWith("#/c/post/")).toBe(false);
		expect(told(loaded, 1)).toContain("Not done: the conversation was no longer open");
		expect((await runOf(loaded, "둘째 글 열어 줘"))?.status).toBe("done");
	});

	it("10-4 the request that carries what the screen answered gets no answer: the turn says the connection was lost, and going on sends what the screen had answered", async () => {
		const story = on({
			script: (ids) => [
				{ calls: [{ name: "list_select", input: { ids: [ids.second] } }] },
				{ text: "둘째 글을 골랐습니다." },
			],
		});
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		// The first request goes through; the one that follows the screen's part does not.
		const back = loaded.net.lose("assistant.run", 1);
		await say("둘째 글 골라 줘");
		await expect.element(panel().getByText("연결이 끊겼습니다")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		expect(going()).toBe(0);
		back();
		await userEvent.click(button("이어서 하기"));
		await expect.element(panel().getByText("둘째 글을 골랐습니다.")).toBeVisible();
		// The model hears what the screen did, not that it was not done.
		expect(told(loaded, 1)).not.toContain("Not done");
		expect(told(loaded, 1)).toContain("done");
	});

	it("10-1 words sent with '지금 보내기' that the run ended without taking, in a conversation left meanwhile, are back over the box and asked when it is opened again", async () => {
		const more = gate();
		const story = on({ script: () => [{ hold: more.wait, text: "첫 답." }, { text: "지금 보낸 말의 답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("첫 질문");
		await expect.poll(() => loaded.model.turns.length).toBe(1);
		await say("지금 보낸 말");
		await userEvent.click(button("지금 보내기"));
		await expect.poll(async () => (await loaded.site.db.selectFrom("run_inbox").select("id").execute()).length).toBe(1);
		await userEvent.click(button("새 대화"));
		more.open();
		await expect.poll(async () => (await runOf(loaded, "첫 질문"))?.status).toBe("done");
		await beat();
		expect(loaded.model.turns).toHaveLength(1);
		await userEvent.click(button("지난 대화"));
		await userEvent.click(past().getByRole("button", { name: "첫 질문", exact: true }));
		await expect.element(panel().getByText("지금 보낸 말의 답.")).toBeVisible();
		const [first, sent] = [await runOf(loaded, "첫 질문"), await runOf(loaded, "지금 보낸 말")];
		expect(sent?.conversation_id).toBe(first?.conversation_id);
	});

	it("10-1 a discard that is refused leaves the review page where it is", async () => {
		const story = on({ script: stories.proposedKinds });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("요약 채우고 제목도 다듬어 줘");
		await userEvent.click(button("검토"));
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		loaded.net.lose("proposals.discard");
		await userEvent.click(page.getByRole("main").getByRole("button", { name: "버리기" }).first());
		await expect.element(page.getByText("서버가 답하지 않았습니다")).toBeVisible();
		await beat();
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		expect((await loaded.site.db.selectFrom("monti_proposal").select("status").execute())[0]?.status).toBe("pending");
	});

	it("10-1 stop pressed just as the run finishes: what waits behind it is not asked", async () => {
		const more = gate();
		const story = on({ script: () => [{ hold: more.wait, text: "끝난 답." }, { text: "묻지 않을 답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("첫 질문");
		await expect.poll(() => loaded.model.turns.length).toBe(1);
		await say("기다리는 말");
		// The word to stop is on its way when the run ends by itself.
		const stop = loaded.net.hold("assistant.stop");
		await userEvent.click(button("멈추기"));
		more.open();
		await expect.element(button("보내기")).toBeVisible();
		stop();
		await beat(500);
		expect(loaded.model.turns).toHaveLength(1);
		await expect.element(button("지금 보내기")).toBeVisible();
	});

	it("10-1 the name on a proposal's bubble in the editor opens the panel on the conversation that proposed it", async () => {
		const reads: { site?: Loaded["site"] } = {};
		const story = on({
			script: (ids) => [
				async () => {
					const made = reads.site as Loaded["site"];
					const now = (await made.monti.run("entries.get", { id: ids.second }, stories.admin)) as {
						entry: { version: number };
					};
					return {
						calls: [
							{
								name: "body_edit",
								input: {
									id: ids.second,
									version: now.entry.version,
									ops: [{ op: "replaceText", block: "b_1", from: 0, to: 2, text: "첫" }],
									_group: "다듬기",
								},
							},
						],
					};
				},
				{ text: "첫 문단을 다듬었습니다." },
			],
		});
		await story.run();
		const loaded = story.loaded();
		reads.site = loaded.site;
		const before = (await loaded.site.monti.run("entries.get", { id: loaded.ids.second }, stories.admin)) as {
			entry: { version: number };
		};
		await loaded.site.monti.run(
			"entries.save",
			{
				id: loaded.ids.second,
				version: before.entry.version,
				doc: {
					type: "doc",
					blocks: [{ id: "b_1", type: "paragraph", content: [{ type: "text", text: "처음 문단입니다." }] }],
				},
			},
			stories.admin,
		);
		await openPanel();
		await say("둘째 글 다듬어 줘");
		await expect.element(panel().getByText("첫 문단을 다듬었습니다.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		// Another conversation is open, and the panel is closed, when the person reads the entry.
		await userEvent.click(button("새 대화"));
		await userEvent.click(page.getByRole("button", { name: "닫기" }));
		window.location.hash = `#/c/post/${loaded.ids.second}`;
		const name = page.getByRole("button", { name: "둘째 글 다듬어 줘", exact: true });
		await expect.element(name).toBeVisible();
		// A toast left from the story before stands over the bubble (its row takes presses across the page's width, and stays while the
		// pointer is on it: T227): it is put away first.
		toast.dismiss();
		await new Promise((resolve) => setTimeout(resolve, 500));
		await userEvent.click(name);
		await expect.element(panel().getByText("첫 문단을 다듬었습니다.")).toBeVisible();
	});

	it("10-1 the states drawn as stories are reached: the card being applied and undone, the review side by side, applied, and with a change made stale", async () => {
		for (const story of [
			stories.CardApplying,
			stories.CardUndone,
			stories.ReviewSideBySide,
			stories.ReviewApplied,
			stories.ReviewChangedMeanwhile,
		])
			await open(story).run();
		await expect.element(page.getByText("그 사이 고쳐짐").first()).toBeVisible();
	});

	it("10-1 each kind of change has its own switch between one line and side by side", async () => {
		const story = on({
			script: async (ids, version) => [
				{
					calls: [
						{
							name: "entries_save",
							input: {
								id: ids.first,
								version: await version(ids.first),
								title: "첫 번째 글, 다시",
								_group: "제목 다듬기",
							},
						},
						{
							name: "entries_save",
							input: {
								id: ids.first,
								version: await version(ids.first),
								values: { summary: "Monti를 처음 쓰는 날을 적었습니다." },
								_group: "요약 다듬기",
							},
						},
					],
				},
				{ text: "제안했습니다." },
			],
		});
		await story.run();
		await openPanel();
		await say("제목과 요약 다듬어 줘");
		await userEvent.click(button("검토"));
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		const side = page.getByRole("tab", { name: "나란히" });
		await expect.poll(() => side.elements().length).toBe(2);
		await userEvent.click(side.first());
		expect(side.elements().map((each) => each.getAttribute("aria-selected"))).toEqual(["true", "false"]);
	});
});

describe("the focus after a pressed control goes (tokens.md, the states)", () => {
	const gate = () => {
		let open = () => {};
		const wait = new Promise<void>((resolve) => {
			open = resolve;
		});
		return { wait, open };
	};
	const past = () => page.getByRole("complementary", { name: "지난 대화" });
	/** Presses a control with the keyboard: the focus is put on it as the Tab key leaves it (a ring), and Enter presses it. */
	async function keyOn(target: { element: () => Element }, key = "{Enter}") {
		await userEvent.keyboard("{Tab}");
		(target.element() as HTMLElement).focus();
		expect(target.element().matches(":focus-visible")).toBe(true);
		await userEvent.keyboard(key);
	}
	/** Where the keyboard's focus is, said so that a miss names what has it instead. */
	const focusIs = (target: () => Element | null | undefined) =>
		expect
			.poll(() => {
				const on = document.activeElement;
				if (on !== null && on === target()) return "there";
				return `on <${on?.tagName.toLowerCase()}> ${on?.getAttribute("aria-label") ?? on?.textContent?.slice(0, 30)}`;
			})
			.toBe("there");

	it("10-1 focus: '새 대화', a request to start from, '다시 하기': pressed with the keyboard, each hands the focus to the box", async () => {
		const story = on({ script: () => [{ text: "첫 답." }, { text: "둘째 답." }, { text: "셋째 답." }] });
		await story.run();
		await openPanel();
		await keyOn(button("요약이 비어 있는 글 찾아 줘"));
		await focusIs(() => box().element());
		await expect.element(panel().getByText("첫 답.")).toBeVisible();
		await expect.element(button("다시 하기")).toBeVisible();
		await keyOn(button("다시 하기"));
		await focusIs(() => box().element());
		await expect.element(panel().getByText("둘째 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await keyOn(button("새 대화"));
		await focusIs(() => box().element());
	});

	it("10-1 focus: with the pointer nothing is handed on: '새 대화' pressed with the mouse leaves the focus off the box", async () => {
		const story = on({ script: () => [{ text: "첫 답." }] });
		await story.run();
		await openPanel();
		await say("첫 질문");
		await expect.element(panel().getByText("첫 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await userEvent.click(button("새 대화"));
		await expect.element(button("요약이 비어 있는 글 찾아 줘").first()).toBeVisible();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(document.activeElement).not.toBe(box().element());
	});

	it("10-1 focus: '이어서 하기' and '다시 시도' hand the focus to the box", async () => {
		const story = on({
			script: () => [
				{ text: "말하다가", breaksOff: true },
				{ text: "끝까지 온 답." },
				{ fail: new ProviderError("unreachable", "fetch failed") },
				{ text: "다시 온 답." },
			],
		});
		await story.run();
		await openPanel();
		await say("첫 질문");
		await expect.element(button("이어서 하기")).toBeVisible();
		await keyOn(button("이어서 하기"));
		await focusIs(() => box().element());
		await expect.element(panel().getByText("끝까지 온 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await say("둘째 질문");
		await expect.element(button("다시 시도")).toBeVisible();
		await keyOn(button("다시 시도"));
		await focusIs(() => box().element());
		await expect.element(panel().getByText("다시 온 답.")).toBeVisible();
	});

	it("10-1 focus: a waiting message cancelled or sent now with the keyboard hands the focus to the message after it, and the last one to the box", async () => {
		const more = gate();
		const story = on({ script: () => [{ hold: more.wait, text: "답." }] });
		await story.run();
		await openPanel();
		await say("첫 질문");
		await expect.poll(() => story.loaded().model.turns.length).toBe(1);
		await say("첫째로 기다리는 말");
		await say("둘째로 기다리는 말");
		await keyOn(button("취소").first());
		await focusIs(() => button("지금 보내기").elements()[0]);
		expect(button("지금 보내기").elements()).toHaveLength(1);
		await keyOn(button("지금 보내기"));
		await focusIs(() => box().element());
		more.open();
	});

	it("10-1 focus: the proposal's row: a button pressed with the keyboard that goes hands the focus to the next control after the row, on the card and on the review page", async () => {
		const story = on({ script: stories.scripts(stories.proposed, stories.proposedKinds) });
		await story.run();
		await openPanel();
		await say("둘 다 요약 채워 줘");
		await expect.element(button("2건 적용")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		const row = () => button("버리기").element().closest("[data-slot=proposal-card]") as HTMLElement;
		const card = row();
		await keyOn(button("버리기"));
		await expect.element(panel().getByText("버림")).toBeVisible();
		// Nothing is left to press in the row: the next control after it has the focus, not the page.
		await expect
			.poll(() => {
				const on = document.activeElement;
				return on !== null && on !== document.body && !card.contains(on) && panel().element().contains(on);
			})
			.toBe(true);

		await userEvent.click(button("새 대화"));
		await say("요약 채우고 제목도 다듬어 줘");
		await userEvent.click(button("검토"));
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		const main = page.getByRole("main");
		await keyOn(main.getByRole("button", { name: "3건 적용" }).first());
		await expect.element(main.getByText("✓ 3건 적용").first()).toBeVisible();
		await expect
			.poll(() => document.activeElement !== document.body && main.element().contains(document.activeElement))
			.toBe(true);
	});

	it("10-1 focus: '다시 만들기' pressed with the keyboard hands the focus to that row's check", async () => {
		const story = on({
			script: stories.scripts(stories.proposed, async (ids, version) => [
				{
					calls: [
						{
							name: "entries_save",
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
		await expect.element(button("다시 만들기")).toBeVisible();
		await keyOn(button("다시 만들기"));
		await expect.element(button("다시 만들기")).not.toBeInTheDocument();
		await focusIs(() => page.getByRole("checkbox", { name: /셋째 글.* 넣기/ }).elements()[0]);
	});

	it("10-1 focus: a past conversation deleted with the keyboard hands the focus to the menu of the row beside it, and the last one to the box", async () => {
		const story = on({ script: () => [{ text: "첫 답." }, { text: "둘째 답." }] });
		await story.run();
		await openPanel();
		await say("먼저 물은 것");
		await expect.element(panel().getByText("첫 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await userEvent.click(button("새 대화"));
		await say("나중에 물은 것");
		await expect.element(panel().getByText("둘째 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await userEvent.click(button("지난 대화"));
		await expect.poll(() => past().getByRole("row").elements().length).toBe(2);
		// The one that is not open: its menu, opened and its one item pressed with the keyboard. No row is after it: the row before.
		await keyOn(button("먼저 물은 것 더 보기"));
		await expect.element(page.getByRole("menuitem", { name: "지우기" })).toBeVisible();
		await userEvent.keyboard("{Enter}");
		await expect.poll(() => past().getByRole("row").elements().length).toBe(1);
		await focusIs(() => button("나중에 물은 것 더 보기").elements()[0]);
		// The last one is the open one: the panel is back on a new conversation, and the focus is in its box.
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "지우기" })).toBeVisible();
		await userEvent.keyboard("{Enter}");
		await expect.element(button("요약이 비어 있는 글 찾아 줘").first()).toBeVisible();
		await focusIs(() => box().element());
	});
});

describe("what the browser check of #480 found", () => {
	const gate = () => {
		let open = () => {};
		const wait = new Promise<void>((resolve) => {
			open = resolve;
		});
		return { wait, open };
	};
	const beat = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
	const past = () => page.getByRole("complementary", { name: "지난 대화" });
	const calls = (loaded: Loaded, name: string) => loaded.net.sent.filter((each) => each.name === name);
	/** Puts the keyboard's focus on a control, as the Tab key leaves it (a ring). */
	async function keyTo(target: { element: () => Element }) {
		await userEvent.keyboard("{Tab}");
		(target.element() as HTMLElement).focus();
		expect(target.element().matches(":focus-visible")).toBe(true);
	}
	/** Enter held down for a while, as a hand holds it: the press, the repeats a held key makes, and letting go. */
	async function holdEnter() {
		await holdKey("Enter", { repeats: 8, every: 35 });
		await releaseKey("Enter");
	}
	const focusIs = (target: () => Element | null | undefined) =>
		expect
			.poll(() => {
				const on = document.activeElement;
				if (on !== null && on === target()) return "there";
				return `on <${on?.tagName.toLowerCase()}> ${on?.getAttribute("aria-label") ?? on?.textContent?.slice(0, 30)}`;
			})
			.toBe("there");
	async function twoConversations() {
		const story = on({ script: () => [{ text: "첫 답." }, { text: "둘째 답." }] });
		await story.run();
		await openPanel();
		await say("먼저 물은 것");
		await expect.element(panel().getByText("첫 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await userEvent.click(button("새 대화"));
		await say("나중에 물은 것");
		await expect.element(panel().getByText("둘째 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await userEvent.click(button("지난 대화"));
		await expect.poll(() => past().getByRole("row").elements().length).toBe(2);
		return story;
	}

	it("10-1 two presses 40 ms apart on 'N건 적용' apply and undo nothing, though 'undo' takes that button's place; later 'undo' is pressed like any button", async () => {
		const story = on({ script: stories.proposed });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("둘 다 요약 채워 줘");
		await expect.element(button("2건 적용")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		// Two presses of the mouse at one spot, 40 ms apart: the second comes down where "undo" stands by then.
		await pressTwice(button("2건 적용").element(), 40);
		await expect.element(panel().getByText("✓ 2건 적용")).toBeVisible();
		await beat(400);
		expect(calls(loaded, "proposals.revert")).toHaveLength(0);
		await expect.element(panel().getByText("✓ 2건 적용")).toBeVisible();
		expect(await summaryOf(loaded, loaded.ids.third)).toBe("셋째 글은 배포한 뒤에 확인할 것을 정리합니다.");
		await beat(300);
		await userEvent.click(button("되돌리기"));
		await expect.element(panel().getByText("되돌림")).toBeVisible();
		expect(calls(loaded, "proposals.revert")).toHaveLength(1);
	});

	it("10-1 Enter held on a past conversation's '지우기' deletes that one conversation: the repeats neither open the next row's menu nor press it", async () => {
		await twoConversations();
		await keyTo(button("먼저 물은 것 더 보기"));
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "지우기" })).toBeVisible();
		await holdEnter();
		await beat();
		expect(past().getByRole("row").elements()).toHaveLength(1);
		expect(page.getByRole("menuitem").elements()).toHaveLength(0);
		await focusIs(() => button("나중에 물은 것 더 보기").elements()[0]);
	});

	it("10-1 focus: the open conversation deleted with the keyboard closes the list onto a new conversation, and the focus is in its box", async () => {
		await twoConversations();
		await keyTo(button("나중에 물은 것 더 보기"));
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "지우기" })).toBeVisible();
		await userEvent.keyboard("{Enter}");
		await expect.element(button("요약이 비어 있는 글 찾아 줘").first()).toBeVisible();
		await focusIs(() => box().element());
	});

	it("10-1 focus: stop pressed with Enter held tells the run to stop once, and when the turn has ended the focus is in the box", async () => {
		const more = gate();
		const story = on({ script: () => [{ hold: more.wait, text: "답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		await say("첫 질문");
		await expect.poll(() => loaded.model.turns.length).toBe(1);
		await keyTo(button("멈추기"));
		await holdEnter();
		more.open();
		await expect.element(button("보내기")).toBeVisible();
		await focusIs(() => box().element());
		expect(calls(loaded, "assistant.stop")).toHaveLength(1);
	});

	it("10-1 focus: to the past conversations and back with the keyboard: the list's first control, then the box; a conversation picked there, the box", async () => {
		const story = on({ script: () => [{ text: "첫 답." }] });
		await story.run();
		await openPanel();
		await say("먼저 물은 것");
		await expect.element(panel().getByText("첫 답.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		await keyTo(button("지난 대화"));
		await userEvent.keyboard("{Enter}");
		await focusIs(() => button("대화로 돌아가기").elements()[0]);
		await userEvent.keyboard("{Enter}");
		await focusIs(() => box().element());
		await keyTo(button("지난 대화"));
		await userEvent.keyboard("{Enter}");
		const row = past().getByRole("button", { name: "먼저 물은 것", exact: true });
		await expect.element(row).toBeVisible();
		await keyTo(row);
		await userEvent.keyboard("{Enter}");
		await expect.element(panel().getByText("첫 답.")).toBeVisible();
		await focusIs(() => box().element());
	});

	it("10-1 focus: the review page left with the keyboard ('버리기') hands the focus to the panel's box beside the screen it goes back to", async () => {
		const story = on({ script: stories.proposedKinds });
		await story.run();
		await openPanel();
		await say("요약 채우고 제목도 다듬어 줘");
		await userEvent.click(button("검토"));
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		await beat(600);
		await keyTo(page.getByRole("main").getByRole("button", { name: "버리기" }).first());
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
		await focusIs(() => box().element());
	});

	it("10-1 the heads of the review page's kinds are one height, before and after the changes are applied: applying moves no row", async () => {
		const story = on({ script: stories.proposedKinds });
		await story.run();
		await openPanel();
		await say("요약 채우고 제목도 다듬어 줘");
		await userEvent.click(button("검토"));
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		const main = page.getByRole("main");
		await expect.element(main.getByText("글, 다시")).toBeVisible();
		const heads = () =>
			[...main.element().querySelectorAll("[data-slot=list-section] > h2")].map(
				(head) => head.getBoundingClientRect().height,
			);
		await beat(600);
		const before = heads();
		expect(before.length).toBeGreaterThan(1);
		expect(new Set(before).size).toBe(1);
		await userEvent.click(main.getByRole("button", { name: "3건 적용" }).first());
		await expect.element(main.getByText("✓ 3건 적용").first()).toBeVisible();
		expect(heads()).toEqual(before);
	});

	it("10-4 a request that gets no answer at all says the connection was lost, in the panel's own words, with the way to send it again", async () => {
		const story = on({ script: () => [{ text: "다시 보낸 답." }] });
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		const back = loaded.net.lose("assistant.run");
		await say("첫 질문");
		await expect.element(panel().getByText("연결이 끊겼습니다")).toBeVisible();
		expect(panel().getByText("서버가 답하지 않았습니다").elements()).toHaveLength(0);
		back();
		await userEvent.click(button("다시 시도"));
		await expect.element(panel().getByText("다시 보낸 답.")).toBeVisible();
	});
});

describe("the assistant from inside an editor (T164; flow 2, 05)", () => {
	const title = () => page.getByRole("textbox", { name: "제목" });
	const titleOf = async (loaded: Loaded, id: string) =>
		((await loaded.site.monti.run("entries.get", { id }, stories.admin)) as { entry: { title: string } }).entry.title;
	const beat = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

	it("10-1 ✦ at the end of the entry editor's head opens the panel beside the entry, which stays as it is; closed, the button is back with the focus and opens it again", async () => {
		const story = open(stories.InEditor);
		await story.run();
		await userEvent.fill(title(), "둘째 글, 고치는 중");
		const typedIn = title().element();
		await userEvent.click(button("어시스턴트 열기"));
		await expect.element(box()).toBeVisible();
		// The entry was not made anew for the panel: the same field, with what was typed.
		expect(title().element()).toBe(typedIn);
		await expect.element(title()).toHaveValue("둘째 글, 고치는 중");
		await expect.element(button("어시스턴트 열기")).not.toBeInTheDocument();
		// This entry goes along.
		await expect.element(button("이 글 빼기")).toBeVisible();
		await userEvent.click(panel().getByRole("button", { name: "닫기" }));
		await expect.poll(() => focused()).toBe(button("어시스턴트 열기").element());
		expect(title().element()).toBe(typedIn);
		await userEvent.keyboard("{Enter}");
		await expect.element(box()).toBeVisible();
	});

	it("10-1 ✦ at the end of the template editor's head opens the panel there too", async () => {
		const story = on({});
		await story.run();
		await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
		window.location.hash = "#/templates/new";
		await userEvent.click(button("어시스턴트 열기"));
		await expect.element(box()).toBeVisible();
		await expect.element(button("어시스턴트 열기")).not.toBeInTheDocument();
	});

	it("10-1 on a site without the assistant an editor's head has no ✦", async () => {
		const story = on({ plugin: false });
		await story.run();
		await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
		window.location.hash = `#/c/post/${story.loaded().ids.second}`;
		await expect.element(title()).toHaveValue("둘째 글");
		expect(button("어시스턴트 열기").elements()).toHaveLength(0);
	});

	it("10-1 [flow 2·05] '저장하고 열기': the open entry is saved, then the entry the assistant was asked for opens; the step is gone", async () => {
		const story = open(stories.SaveAndOpen);
		await story.run();
		const loaded = story.loaded();
		// Nothing moved, and nothing was saved, when the assistant was asked.
		expect(window.location.hash).toBe(`#/c/post/${loaded.ids.second}`);
		expect(await titleOf(loaded, loaded.ids.second)).toBe("둘째 글");
		await userEvent.click(button("저장하고 열기"));
		await expect.poll(() => window.location.hash).toBe(`#/c/post/${loaded.ids.third}`);
		await expect.element(title()).toHaveValue("셋째 글");
		expect(await titleOf(loaded, loaded.ids.second)).toBe("둘째 글, 고치는 중");
		await expect.element(button("저장하고 열기")).not.toBeInTheDocument();
	});

	it("10-1 '저장하고 열기' when the save is refused: the editor says why as it always does, the screen stays, and the step is still there", async () => {
		const story = open(stories.SaveAndOpen);
		await story.run();
		const loaded = story.loaded();
		loaded.net.lose("entries.save");
		await userEvent.click(button("저장하고 열기"));
		await expect.element(page.getByText("서버가 답하지 않았습니다")).toBeVisible();
		await beat();
		expect(window.location.hash).toBe(`#/c/post/${loaded.ids.second}`);
		await expect.element(title()).toHaveValue("둘째 글, 고치는 중");
		await expect.element(button("저장하고 열기")).toBeVisible();
		expect(await titleOf(loaded, loaded.ids.second)).toBe("둘째 글");
	});

	it("10-1 focus: asked to show a list from an entry with unsaved changes, '저장하고 열기' pressed with the keyboard saves, shows the list, and hands the focus to the box", async () => {
		const story = on({
			script: () => [
				{ calls: [{ name: "list_show", input: { collection: "post", query: { filters: [] } } }] },
				{ text: "저장하지 않은 변경이 있어 옮기지 않았습니다." },
			],
		});
		await story.run();
		const loaded = story.loaded();
		await openPanel();
		window.location.hash = `#/c/post/${loaded.ids.second}`;
		await expect.element(title()).toHaveValue("둘째 글");
		await userEvent.fill(title(), "둘째 글, 고치는 중");
		await say("글 목록 보여 줘");
		await expect.element(button("저장하고 열기")).toBeVisible();
		await userEvent.keyboard("{Tab}");
		(button("저장하고 열기").element() as HTMLElement).focus();
		expect(button("저장하고 열기").element().matches(":focus-visible")).toBe(true);
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("heading", { name: "post" })).toBeVisible();
		expect(await titleOf(loaded, loaded.ids.second)).toBe("둘째 글, 고치는 중");
		await expect.poll(() => focused()).toBe(box().element());
	});

	it("10-1 a new request takes the step away: it was about what was asked before", async () => {
		const story = open(stories.SaveAndOpen);
		await story.run();
		story.loaded().model.add({ text: "네." });
		await say("됐어, 그냥 둬");
		await expect.element(panel().getByText("네.")).toBeVisible();
		await expect.element(button("보내기")).toBeVisible();
		expect(button("저장하고 열기").elements()).toHaveLength(0);
	});
});
