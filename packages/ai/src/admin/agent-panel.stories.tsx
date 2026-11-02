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

const api =
	(view: AiSettingsView): FakeApi =>
	(path, method, body) => {
		if (path === "/api/monti/v1/ai/settings" && method === "GET") return view;
		if (path === "/api/monti/v1/ai/models") {
			return { items: (MODELS[(body as { keyId: string }).keyId] ?? []).map((id) => ({ id })) };
		}
		if (path.startsWith("/api/monti/v1/ai/agent/runs?"))
			return {
				items: [
					{
						id: "r1",
						title: "How many posts are drafts?",
						status: "done",
						usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
						createdAt: "2026-10-26T09:00:00.000Z",
						updatedAt: "2026-10-26T09:00:00.000Z",
					},
				],
				total: 1,
			};
		return {};
	};

type Chunk = Record<string, unknown>;
/** The server's answer as the AI SDK's UI message stream, one chunk per event. */
const sse = (chunks: Chunk[]) =>
	new Response(
		new ReadableStream({
			start(controller) {
				const encoder = new TextEncoder();
				for (const chunk of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			},
		}),
		{ headers: { "content-type": "text/event-stream" } },
	);

const conversation: Chunk[] = [
	{ type: "start", messageId: "m1", messageMetadata: { runId: "r1" } },
	{ type: "start-step" },
	{
		type: "tool-input-available",
		toolCallId: "c1",
		toolName: "entries_list",
		input: { collection: "post", status: "draft" },
	},
	{ type: "tool-output-available", toolCallId: "c1", output: { items: [{ id: "a" }, { id: "b" }], total: 2 } },
	{ type: "tool-input-available", toolCallId: "c2", toolName: "entries_get", input: { id: "gone" } },
	{
		type: "tool-output-available",
		toolCallId: "c2",
		output: { error: { code: "not_found", message: "No such entry" } },
	},
	{ type: "text-start", id: "t" },
	{ type: "text-delta", id: "t", delta: "Two posts are drafts. One entry I tried to open no longer exists." },
	{ type: "text-end", id: "t" },
	{ type: "finish-step" },
	{
		type: "finish",
		messageMetadata: { runId: "r1", usage: { inputTokens: 1200, outputTokens: 80, totalTokens: 1280 } },
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
			{answer && <AgentAnswer answer={answer} />}
			<ScreenContextProvider>
				<Where {...where}>
					<div style={{ width: 380, height: "100svh", display: "flex", flexDirection: "column" }}>
						<AgentPanel onClose={() => undefined} />
					</div>
				</Where>
			</ScreenContextProvider>
		</PageFrame>
	);

const send = async (canvasElement: HTMLElement, text: string) => {
	const canvas = within(canvasElement);
	await userEvent.type(await canvas.findByRole("textbox"), text);
	await userEvent.click(await canvas.findByRole("button", { name: /보내기|Send/ }));
};

// --- Stories ---

/** Nothing asked yet: what the assistant can do, and the model it runs on (the default, thinking at the default level). */
export const Empty: Story = { render: panel(ready) };

/** Over the entry editor the empty state says it can read the open entry. */
export const EmptyOverEntry: Story = {
	render: panel(ready, undefined, { screen: "entry", collection: "post", entryId: "e1" }),
};

/** An answer with a tool call that worked, one that failed, the streamed text and the usage of the conversation. */
export const ConversationWithToolCalls: Story = {
	render: panel(ready, () => sse(conversation)),
	play: async ({ canvasElement }) => {
		await send(canvasElement, "Which posts are drafts?");
		await within(canvasElement).findByText(/Two posts are drafts/);
		expect(within(canvasElement).getAllByRole("button", { name: /entries\./ })).toHaveLength(2);
	},
};

/** A tool line opened: the input and the result of the call. */
export const ToolCallOpen: Story = {
	render: panel(ready, () => sse(conversation)),
	play: async ({ canvasElement }) => {
		await send(canvasElement, "Which posts are drafts?");
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /entries\.list/ }));
		await within(canvasElement).findAllByText(/"collection": "post"/);
	},
};

/** The past conversations menu. */
export const PastConversations: Story = {
	render: panel(ready),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /지난 대화|Past conversations/ }));
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
