import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ScreenContextProvider, usePublishScreenContext } from "../../../admin/src/screens/shared/screen-context";
import { type FakeApi, PageFrame } from "../../../admin/src/stories/screen-frame";
import type { AiSettingsView } from "../connection";
import { AgentPanel } from "./agent-panel";

const meta = { title: "Screens/AI/Assistant panel", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// --- Fixtures ---

const ready: AiSettingsView = {
	version: 1,
	keys: [
		{ id: "a", name: "Anthropic 개인", service: "anthropic", ready: true },
		{ id: "o", name: "OpenRouter", service: "openrouter", ready: true },
	],
	quick: { keyId: "a", model: "claude-haiku-5-5", keyName: "Anthropic 개인" },
	assistant: { keyId: "a", model: "claude-sonnet-5-5", keyName: "Anthropic 개인" },
	toolSupport: { o: { "meta/llama-3-8b": false } },
	fake: false,
	unopenedDays: 30,
};
const noKey: AiSettingsView = { ...ready, keys: [], quick: null, assistant: null, toolSupport: {} };

const MODELS: Record<string, string[]> = {
	a: ["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5"],
	o: [
		"anthropic/claude-opus-5-5",
		"deepseek/deepseek-chat",
		"google/gemini-2.5-pro",
		"openai/gpt-5",
		"meta/llama-3-8b",
	],
};

const at = (daysAgo: number, time: string) => {
	const day = new Date();
	day.setDate(day.getDate() - daysAgo);
	return `${day.toISOString().slice(0, 10)}T${time}:00`;
};
const run = (id: string, title: string, when: string) => ({
	id,
	title,
	status: "done",
	usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
	createdAt: when,
	updatedAt: when,
});
/** The past conversations: two of today, three earlier. */
const RUNS = [
	run("r5", "더 짧게 다듬어 줘. 말투는 그대로.", at(0, "10:58")),
	run(
		"r4",
		"이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고, ‘발행 후 고친 글’은 더 짧게 다듬어 줘.",
		at(0, "10:52"),
	),
	run("r3", "쓰지 않는 태그 정리해 줘", at(9, "15:20")),
	run("r2", "이 글 영어로 옮겨 줘", at(11, "09:10")),
	run("r1", "지난달 많이 읽힌 글 알려 줘", at(30, "18:02")),
];
/** A conversation of another day, as opening it from the list gives it. */
const OLD_RUN = {
	...RUNS[2],
	model: { keyId: "a", model: "claude-opus-5-5", thinking: "high" },
	messages: [
		{ id: "u1", role: "user", parts: [{ type: "text", text: "쓰지 않는 태그 정리해 줘" }] },
		{
			id: "a1",
			role: "assistant",
			parts: [
				{ type: "step-start" },
				{
					type: "tool-entries_list",
					toolCallId: "c1",
					state: "output-available",
					input: { collection: "tag" },
					output: { items: [], total: 38 },
				},
				{
					type: "tool-entries_usages",
					toolCallId: "c2",
					state: "output-available",
					input: { id: "t1" },
					output: { total: 0 },
				},
				{ type: "text", text: "글에 한 번도 안 쓰인 태그가 4개예요." },
			],
		},
	],
};

const api =
	(view: AiSettingsView): FakeApi =>
	(path, method, body) => {
		if (path === "/api/monti/v1/ai/settings" && method === "GET") return view;
		if (path === "/api/monti/v1/ai/models") {
			return { items: (MODELS[(body as { keyId: string }).keyId] ?? []).map((id) => ({ id })) };
		}
		if (path.startsWith("/api/monti/v1/ai/agent/runs?")) return { items: RUNS, total: RUNS.length };
		if (path.startsWith("/api/monti/v1/ai/agent/runs/") && method === "GET") return OLD_RUN;
		if (path.startsWith("/api/monti/v1/ai/agent/runs/") && method === "DELETE") return { deleted: true };
		if (path.endsWith("/discard")) return { ...PROPOSAL, status: "discarded", settledAt: "2026-11-03T10:52:00.000Z" };
		return {};
	};

type Chunk = Record<string, unknown>;
/** The server's answer as the AI SDK's UI message stream, one chunk per event. */
const sse = (chunks: Chunk[], { open = false }: { open?: boolean } = {}) =>
	new Response(
		new ReadableStream({
			start(controller) {
				const encoder = new TextEncoder();
				for (const chunk of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
				// An answer still being written stays open.
				if (open) return;
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			},
		}),
		{ headers: { "content-type": "text/event-stream" } },
	);

/** The first part of the answer to "요약이 비어 있는 글 찾아 줘": the list read, and the next read started. */
const working: Chunk[] = [
	{ type: "start", messageId: "m1", messageMetadata: { runId: "r9" } },
	{ type: "start-step" },
	{ type: "tool-input-available", toolCallId: "c1", toolName: "entries_list", input: { collection: "post" } },
	{ type: "tool-output-available", toolCallId: "c1", output: { items: [], total: 148 } },
	{
		type: "tool-input-available",
		toolCallId: "c2",
		toolName: "entries_list",
		input: { collection: "post", field: ["summary:empty"] },
	},
];
const item = (
	id: string,
	operation: string,
	spot: string,
	title: string,
	before: unknown,
	after: unknown,
	extra = {},
) => ({
	id,
	operation,
	target: { kind: operation.startsWith("media") ? "media" : "entry", id: `t-${id}`, spot },
	preview: { before, after },
	subject: { title, path: `/${id}`, collection: "post" },
	included: true,
	state: "pending",
	...extra,
});
/** A proposal of four groups (flow 2 · 11): a summary filled on two posts, eleven moved, three images to the trash, one title tidied. */
const PROPOSAL = {
	id: "p1",
	runId: "r9",
	request: "이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고, 쓰지 않는 이미지도 지워 줘.",
	status: "pending",
	createdAt: "2026-11-03T10:51:00.000Z",
	items: [
		item("e1", "entries.updateFields", "title", "발행 후 고친 글", "발행 후에 고친 글", "발행 후 고친 글"),
		item(
			"e2",
			"entries.updateFields",
			"summary",
			"타입 정리 메모",
			null,
			"자주 헷갈리는 타입 세 가지를 예시로 정리한 메모.",
		),
		item("e3", "entries.updateFields", "summary", "쓰는 중인 글", null, "글보다 도구를 고친 이야기."),
		...Array.from({ length: 11 }, (_, index) =>
			item(`m${index}`, "entries.moveToFolder", "folder", `작년 글 ${index + 1}`, null, "f2024", {
				shown: { before: null, after: "2024" },
			}),
		),
		...["old-cover.png", "scan-01.jpg", "tmp.gif"].map((name, index) =>
			item(`x${index}`, "media.trash", "trash", name, "live", "trash"),
		),
	],
};
const ALT_PROPOSAL = {
	...PROPOSAL,
	id: "p2",
	request: "고른 이미지 3개에 대체 텍스트 채워 줘",
	items: [
		["desk-morning.jpg", "아침 햇빛이 드는 책상 위 노트북과 커피"],
		["cover-cache.png", "밝은 종이 위에 놓인 캐시 글 제목"],
		["seoul-night.jpg", "비 갠 밤, 불 켜진 서울 골목과 젖은 보도"],
	].map(([name, alt], index) => item(`a${index}`, "media.updateText", "defaultAlt", name ?? "", null, alt)),
};
/** An answer that proposed: the tool lines, the proposal and the words. */
const proposing = (proposal: typeof PROPOSAL): Chunk[] => [
	{ type: "start", messageId: "m1", messageMetadata: { runId: "r9" } },
	{ type: "start-step" },
	{ type: "tool-input-available", toolCallId: "c1", toolName: "entries_updateFields", input: {} },
	{ type: "tool-output-available", toolCallId: "c1", output: { proposed: proposal.items.length } },
	{ type: "data-proposal", id: proposal.id, data: proposal },
	{ type: "text-start", id: "t" },
	{ type: "text-delta", id: "t", delta: "제안을 만들었어요. 보고 적용해 주세요." },
	{ type: "text-end", id: "t" },
	{ type: "finish-step" },
	{ type: "finish", messageMetadata: { runId: "r9" } },
];

const conversation: Chunk[] = [
	...working,
	{ type: "tool-output-available", toolCallId: "c2", output: { items: [{ id: "a" }, { id: "b" }], total: 2 } },
	{ type: "text-start", id: "t" },
	{ type: "text-delta", id: "t", delta: "요약이 빈 글은 두 편이에요. ‘캐시 다시 보기’와 ‘서울의 밤’이에요." },
	{ type: "text-end", id: "t" },
	{ type: "finish-step" },
	{
		type: "finish",
		messageMetadata: { runId: "r9", usage: { inputTokens: 1200, outputTokens: 80, totalTokens: 1280 } },
	},
];

/** Answers the next request to the agent with `answer`, and every other request as `PageFrame` does. */
function AgentAnswer({ answer }: { answer: () => Response }) {
	useState(() => {
		const base = window.fetch;
		window.fetch = (input, init) =>
			String(input).endsWith("/v1/ai/agent") && init?.method === "POST" ? Promise.resolve(answer()) : base(input, init);
	});
	return null;
}
/** Each story starts with no conversation remembered in this browser (the panel opens the last one again otherwise). */
function Fresh() {
	useState(() => {
		for (const key of Object.keys(window.localStorage))
			if (key.includes("agent-run")) window.localStorage.removeItem(key);
	});
	return null;
}
function Where({ children, ...context }: { children: ReactNode } & Parameters<typeof usePublishScreenContext>[0]) {
	usePublishScreenContext(context);
	return children;
}

/** The panel at the width it has beside a screen. */
const panel =
	(
		view: AiSettingsView,
		answer?: () => Response,
		where: Parameters<typeof usePublishScreenContext>[0] = { screen: "entries" },
	) =>
	() => (
		<PageFrame api={api(view)}>
			<Fresh />
			{answer && <AgentAnswer answer={answer} />}
			<ScreenContextProvider>
				<Where {...where}>
					<div style={{ width: 380, height: "100svh", display: "flex" }}>
						<AgentPanel onClose={() => undefined} />
					</div>
				</Where>
			</ScreenContextProvider>
		</PageFrame>
	);

const send = async (canvasElement: HTMLElement, text: string) => {
	const canvas = within(canvasElement);
	// The model has loaded: the box can send.
	await canvas.findByRole("button", { name: "모델 고르기" });
	await userEvent.type(await canvas.findByRole("textbox"), text);
	await userEvent.click(await canvas.findByRole("button", { name: /보내기|Send/ }));
};

// --- Stories ---

/** Nothing asked yet, on the post list (flow 2 · 01): this list's default requests, the recent ones, and the model it runs on. */
export const Empty: Story = { tags: ["visual"], render: panel(ready) };

/** On the entry editor the default requests are about the open entry, and the box asks about it. */
export const EmptyOverEntry: Story = {
	tags: ["visual"],
	render: panel(ready, undefined, { screen: "entry", collection: "post", entryId: "e1" }),
};

/** A default request pressed, while the assistant works (flow 2 · 02): what it read so far, the read under way, and the stop button. */
export const Working: Story = {
	tags: ["visual"],
	render: panel(ready, () => sse(working, { open: true })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "요약이 비어 있는 글 찾아 줘" }));
		await within(canvasElement).findByText("글 목록 읽음 · 게시글 148편");
		await within(canvasElement).findByRole("button", { name: "멈추기" });
	},
};

/** The answer: the tool lines say what was read, then the words. A line opens to show the input and the result. */
export const Answered: Story = {
	render: panel(ready, () => sse(conversation)),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "요약이 비어 있는 글 찾아 줘" }));
		await within(canvasElement).findByText(/요약이 빈 글은 두 편이에요/);
		expect(within(canvasElement).getByText("글 목록 읽음 · 게시글 2편")).toBeTruthy();
	},
};

/** A tool line opened: the input and the result of the call. */
export const ToolCallOpen: Story = {
	render: panel(ready, () => sse(conversation)),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "요약이 비어 있는 글 찾아 줘" }));
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /게시글 148편/ }));
		await within(canvasElement).findAllByText(/"collection": "post"/);
	},
};

/** A request that proposed changes (flow 2 · 11): the card in the answer with its groups, "상세 보기", "버리기" and "19건 적용". */
export const ProposalWaiting: Story = {
	tags: ["visual"],
	render: panel(ready, () => sse(proposing(PROPOSAL))),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "요약이 비어 있는 글 찾아 줘" }));
		await within(canvasElement).findByTestId("agent-proposal");
	},
};

/** New alt texts for three files (flow 2 · 19): each file's text in the card, and "3개 적용". */
export const ProposalAltText: Story = {
	tags: ["visual"],
	render: panel(ready, () => sse(proposing(ALT_PROPOSAL as typeof PROPOSAL))),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "요약이 비어 있는 글 찾아 줘" }));
		await within(canvasElement).findByTestId("agent-proposal");
	},
};

/** Cut off while working (flow 2 · 06): what it got done stays, the read under way stopped there, and "이어서 하기" goes on from it. */
export const Cut: Story = {
	tags: ["visual"],
	render: panel(ready, () => sse([...working, { type: "error", errorText: "terminated" }])),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "요약이 비어 있는 글 찾아 줘" }));
		await within(canvasElement).findByText("연결이 끊겼어요");
		await within(canvasElement).findByText("글 목록 읽기 · 여기서 멈춤");
	},
};

/** On the entry editor (flow 2 · 07): the box asks about this entry. */
export const OnEntry: Story = {
	tags: ["visual"],
	render: panel(ready, () => sse(conversation), { screen: "entry", collection: "post", entryId: "e1" }),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "이 글에서 고칠 곳 찾아 줘" }));
		await within(canvasElement).findByText(/요약이 빈 글은 두 편이에요/);
		await userEvent.type(within(canvasElement).getByRole("textbox"), "더 짧게 다듬어 줘. 말투는 그대로.");
	},
};

/** Rows picked in the list (flow 2 · 10): the box shows them as a chip; × leaves them out of the request. The message says what it was about. */
export const PickedRows: Story = {
	tags: ["visual"],
	render: panel(ready, () => sse(conversation), { screen: "entries", collection: "post", selectedIds: ["a", "b"] }),
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByText("고른 글 2편");
		await userEvent.type(
			within(canvasElement).getByRole("textbox"),
			"이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮겨 줘.",
		);
	},
};

/** The past conversations (flow 2 · 25): today's and the earlier ones, the open one marked, a ⋯ that deletes, and how long unopened ones stay. */
export const PastConversations: Story = {
	tags: ["visual"],
	render: panel(ready),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "지난 대화" }));
		await within(canvasElement).findByText("쓰지 않는 태그 정리해 줘");
	},
};

/** A conversation of another day opened again (flow 2 · 26): its day over it, its messages and its model as they were. */
export const Reopened: Story = {
	tags: ["visual"],
	render: panel(ready),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "지난 대화" }));
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /^쓰지 않는 태그 정리해 줘/ }));
		await within(canvasElement).findByText("태그 읽음 · 38개");
	},
};

/** No key of an AI service (flow 2 · 22): the panel says so and sends the admin to the API keys; no box to type in. */
export const NoKey: Story = { tags: ["visual"], render: panel(noKey) };

const openMenu = async (canvasElement: HTMLElement) => {
	await userEvent.click(await within(canvasElement).findByRole("button", { name: "모델 고르기" }));
	await within(document.body).findByRole("menu");
};

/** The model menu (flow 2 · 23): a search line, the recent models with the default first, the models of each key, and 생각 ›. */
export const ModelMenuOpen: Story = {
	tags: ["visual"],
	render: panel(ready),
	play: async ({ canvasElement }) => {
		await openMenu(canvasElement);
		await within(document.body).findByText("claude-opus-5-5");
	},
};

/** 생각 › opens the levels at the side, the current one ticked (flow 2 · 23b). */
export const ThinkingLevels: Story = {
	tags: ["visual"],
	render: panel(ready),
	play: async ({ canvasElement }) => {
		await openMenu(canvasElement);
		await userEvent.click(await within(document.body).findByRole("menuitem", { name: /생각/ }));
		await within(document.body).findByRole("menuitemradio", { name: "높음" });
	},
};

/** 높음 picked: the menu closes and the button says "· 생각 높음" (flow 2 · 23c). */
export const ThinkingHigh: Story = {
	tags: ["visual"],
	render: panel(ready),
	play: async ({ canvasElement }) => {
		await openMenu(canvasElement);
		await userEvent.click(await within(document.body).findByRole("menuitem", { name: /생각/ }));
		await userEvent.click(await within(document.body).findByRole("menuitemradio", { name: "높음" }));
		await within(canvasElement).findByText(/생각 높음/);
	},
};

/** A model that cannot think: no 생각 row, and nothing about it on the button (flow 2 · 23d). */
export const ModelWithoutThinking: Story = {
	tags: ["visual"],
	render: panel(ready),
	play: async ({ canvasElement }) => {
		await openMenu(canvasElement);
		await userEvent.click(await within(document.body).findByRole("menuitemradio", { name: /deepseek\/deepseek-chat/ }));
		await openMenu(canvasElement);
	},
};

/** The service is out of credit (flow 2 · 24): a notice in the conversation with the key, and "다른 모델로 보내기". */
export const OutOfCredit: Story = {
	tags: ["visual"],
	render: panel(ready, () =>
		sse([
			{ type: "start", messageId: "m1" },
			{ type: "error", errorText: "credit_exhausted" },
		]),
	),
	play: async ({ canvasElement }) => {
		await send(canvasElement, "이 두 편에 요약 써 줘");
		await within(canvasElement).findByText(/크레딧이 부족해요/);
	},
};

/** The request failed for another reason: it says so and offers to try again. */
export const RequestFailed: Story = {
	render: panel(ready, () =>
		sse([
			{ type: "start", messageId: "m1" },
			{ type: "error", errorText: "Provider down" },
		]),
	),
	play: async ({ canvasElement }) => {
		await send(canvasElement, "Hello");
		await within(canvasElement).findByRole("alert");
	},
};
