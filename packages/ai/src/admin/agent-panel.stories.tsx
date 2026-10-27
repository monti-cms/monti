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

const settings = (effective: AiSettingsView["agent"]["effective"]): AiSettingsView => ({
	version: 1,
	providers: [],
	agent: { setting: null, effective },
	fake: false,
});
const ready = settings({ providerId: "p1", providerName: "OpenRouter", model: "google/gemini-2.5-flash", tools: true });

const api =
	(view: AiSettingsView): FakeApi =>
	(path, method) => {
		if (path === "/api/monti/v1/ai/settings" && method === "GET") return view;
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
					<div
						style={{ width: 400, height: "100svh", borderInlineStart: "1px solid var(--monti-border-muted, #8884)" }}
					>
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

/** Nothing asked yet: what the assistant can do, and the model it runs on. */
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

/** No ready connection: one line with what to do, a link to the AI screen, and no box to type in. */
export const CannotRunNoConnection: Story = { render: panel(settings(null)) };

/** The chosen model can't call tools (the connection check found out): which model, and where to pick another. */
export const CannotRunNoToolSupport: Story = {
	render: panel(settings({ providerId: "p1", providerName: "OpenRouter", model: "small-model", tools: false })),
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
