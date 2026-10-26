// @vitest-environment jsdom

import { type OpenEditor, OpenEditorProvider } from "@monti-cms/admin";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenContextProvider, usePublishScreenContext } from "../../../../admin/src/screens/shared/screen-context";
import { jsonResponse as json } from "../../../../admin/src/test/fetch";
import { createTestRouter } from "../../../../admin/src/test/router";
import { SiteWrapper } from "../../../../admin/src/test/site";
import { testSite } from "../../../test/site";
import type { AiSettingsView } from "../../connection";
import { AgentPanel } from "../agent-panel";
import { agentPanelMessages } from "../agent-panel.messages";

const t = testSite.createTranslator(agentPanelMessages);
const { render: renderRouted } = createTestRouter();

/** Parts of the AI SDK's UI message stream, as the server writes them (one server-sent event each). */
type Chunk = Record<string, unknown>;
const stream = (chunks: Chunk[]) =>
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

/** The answer to a refused request: an ordinary error answer (`{ error: { code, message } }`), not a stream. */
const refusal = (code: string, status: number, message = "Refused") =>
	new Response(JSON.stringify({ error: { code, message } }), {
		status,
		headers: { "content-type": "application/json" },
	});

const USAGE = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
const answer = (
	parts: Chunk[],
	{ runId = "run-1", usage = USAGE }: { runId?: string; usage?: typeof USAGE | null } = {},
): Chunk[] => [
	{ type: "start", messageId: `m-${Math.random()}`, messageMetadata: { runId } },
	{ type: "start-step" },
	...parts,
	{ type: "finish-step" },
	{ type: "finish", messageMetadata: { runId, ...(usage ? { usage } : {}) } },
];
const text = (value: string): Chunk[] => [
	{ type: "text-start", id: "t" },
	{ type: "text-delta", id: "t", delta: value },
	{ type: "text-end", id: "t" },
];
const toolCall = (toolCallId: string, toolName: string, input: unknown, output?: unknown): Chunk[] => [
	{ type: "tool-input-available", toolCallId, toolName, input },
	...(output === undefined ? [] : [{ type: "tool-output-available", toolCallId, output }]),
];

const settings = (overrides: Partial<AiSettingsView> = {}): AiSettingsView => ({
	version: 1,
	providers: [],
	fake: false,
	agent: {
		setting: null,
		effective: { providerId: "p1", providerName: "Main", model: "big-model", tools: true },
	},
	...overrides,
});

const onClose = vi.fn();
const server = {
	settings: settings(),
	runs: [] as Array<{ id: string; title: string }>,
	run: {} as Record<string, unknown>,
	/** What the next requests to the agent answer, in order. */
	agent: [] as Array<() => Response>,
};
let fetchMock: ReturnType<typeof vi.fn>;
const agentRequests = () =>
	fetchMock.mock.calls
		.filter(([input, init]) => String(input).endsWith("/v1/ai/agent") && init?.method === "POST")
		.map(([, init]) => JSON.parse(String((init as RequestInit).body)));

beforeEach(() => {
	window.localStorage.clear();
	server.settings = settings();
	server.runs = [];
	server.run = {};
	server.agent = [];
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = String(input);
		if (url.endsWith("/v1/ai/settings")) return json(server.settings);
		if (url.includes("/v1/ai/agent/runs?")) return json({ items: server.runs, total: server.runs.length });
		if (url.includes("/v1/ai/agent/runs/")) return json(server.run);
		if (url.endsWith("/v1/ai/agent") && init?.method === "POST") {
			const next = server.agent.shift();
			if (!next) throw new Error("Unexpected agent request");
			return next();
		}
		throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${url}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** Where the admin is, as a screen would publish it. */
function Where({ context }: { context: Parameters<typeof usePublishScreenContext>[0] }) {
	usePublishScreenContext(context);
	return null;
}
const renderPanel = (
	options: { context?: Parameters<typeof usePublishScreenContext>[0]; editor?: OpenEditor; extra?: ReactNode } = {},
) => {
	const panel = (
		<ScreenContextProvider>
			<Where context={options.context ?? { screen: "other" }} />
			<AgentPanel onClose={onClose} />
		</ScreenContextProvider>
	);
	return renderRouted(
		<SiteWrapper>
			{options.editor ? <OpenEditorProvider editor={options.editor}>{panel}</OpenEditorProvider> : panel}
		</SiteWrapper>,
	);
};
/** An element whose own text holds `part` (a message in the dictionary is plain text, not a pattern). */
const includes = (part: string) => (_: string, element: Element | null) =>
	element?.tagName === "P" && (element.textContent ?? "").includes(part);
const ask = async (message: string) => {
	const box = await screen.findByRole("textbox", { name: t("input.label") });
	await waitFor(() => expect(box).not.toBeDisabled());
	fireEvent.change(box, { target: { value: message } });
	fireEvent.click(screen.getByRole("button", { name: t("send") }));
};

describe("assistant panel — conversation", () => {
	it("shows the question, the tool call as a compact line, the streamed answer and the usage", async () => {
		server.agent.push(() =>
			stream(
				answer([
					...toolCall("c1", "entries_list", { collection: "post" }, { items: [{ id: "a" }], total: 1 }),
					...text("You have one post."),
				]),
			),
		);
		renderPanel();
		await ask("How many posts?");

		expect(await screen.findByText("You have one post.")).toBeTruthy();
		expect(screen.getByText("How many posts?")).toBeTruthy();
		// The line names the operation (not the tool name the model used) and says it is done.
		const line = screen.getByRole("button", { name: /entries\.list/ });
		expect(within(line).getByText(t("tool.done"))).toBeTruthy();
		expect(screen.getByText(t("usage.tokens", { count: "150" }))).toBeTruthy();
	});

	it("opens a tool line to show the input and the result", async () => {
		server.agent.push(() =>
			stream(answer([...toolCall("c1", "entries_list", { collection: "post" }, { total: 7 }), ...text("Seven.")])),
		);
		renderPanel();
		await ask("count");
		const line = await screen.findByRole("button", { name: /entries\.list/ });
		expect(screen.queryByText(t("tool.input"))).toBeNull();
		fireEvent.click(line);
		expect(await screen.findByText(t("tool.input"))).toBeTruthy();
		expect(screen.getByText(t("tool.result"))).toBeTruthy();
		const shown = document.body.textContent ?? "";
		expect(shown).toContain('"collection": "post"');
		expect(shown).toContain('"total": 7');
	});

	it("marks a call as failed when the operation answered with an error, and when it could not run at all", async () => {
		server.agent.push(() =>
			stream(
				answer([
					...toolCall("c1", "entries_get", { id: "x" }, { error: { code: "not_found", message: "No such entry" } }),
					{ type: "tool-input-available", toolCallId: "c2", toolName: "media_list", input: {} },
					{ type: "tool-output-error", toolCallId: "c2", errorText: "boom" },
					...text("Neither worked."),
				]),
			),
		);
		renderPanel();
		await ask("try");
		await screen.findByText("Neither worked.");
		for (const name of [/entries\.get/, /media\.list/]) {
			expect(within(screen.getByRole("button", { name })).getByText(t("tool.failed"))).toBeTruthy();
		}
	});

	it("sends where the admin is with each request, and the run it belongs to from the second one on", async () => {
		server.agent.push(
			() => stream(answer(text("one"), { runId: "run-7" })),
			() => stream(answer(text("two"), { runId: "run-7" })),
		);
		renderPanel({ context: { screen: "entries", collection: "post", selectedIds: ["a", "b"] } });
		await ask("first");
		await screen.findByText("one");
		await ask("second");
		await screen.findByText("two");

		const [first, second] = agentRequests();
		expect(first.context).toEqual({ screen: "entries", collection: "post", selectedIds: ["a", "b"] });
		expect(first.runId).toBeUndefined();
		expect(second.runId).toBe("run-7");
		expect(second.messages.length).toBeGreaterThan(first.messages.length);
	});

	it("leaves an empty selection and an unset collection out of the context", async () => {
		server.agent.push(() => stream(answer(text("ok"))));
		renderPanel({ context: { screen: "media", selectedIds: [] } });
		await ask("hi");
		await screen.findByText("ok");
		expect(agentRequests()[0].context).toEqual({ screen: "media" });
	});

	it("starts a new conversation without the old run", async () => {
		server.agent.push(
			() => stream(answer(text("one"), { runId: "run-1" })),
			() => stream(answer(text("fresh"), { runId: "run-2" })),
		);
		renderPanel();
		await ask("first");
		await screen.findByText("one");
		fireEvent.click(screen.getByRole("button", { name: t("conversation.new") }));
		expect(screen.queryByText("one")).toBeNull();
		await ask("again");
		await screen.findByText("fresh");
		expect(agentRequests()[1].runId).toBeUndefined();
		expect(agentRequests()[1].messages).toHaveLength(1);
	});

	it("says which connection and model it runs on", async () => {
		renderPanel();
		expect(await screen.findByText(t("model.use", { model: "big-model", connection: "Main" }))).toBeTruthy();
	});
});

describe("assistant panel — frame", () => {
	it("closes from its header", async () => {
		renderPanel();
		fireEvent.click(await screen.findByRole("button", { name: "Close" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("marks the answer as streaming while it arrives and not after", async () => {
		server.agent.push(() => stream(answer(text("Done."))));
		renderPanel();
		await ask("hi");
		const answerText = await screen.findByText("Done.");
		await waitFor(() => expect(answerText.getAttribute("aria-busy")).toBeNull());
		expect(answerText.getAttribute("data-author")).toBe("assistant");
		expect(screen.getByText("hi").getAttribute("data-author")).toBe("user");
	});
});

describe("assistant panel — past conversations", () => {
	const stored = [
		{ id: "u1", role: "user", parts: [{ type: "text", text: "An old question" }] },
		{
			id: "a1",
			role: "assistant",
			metadata: { runId: "old-run", usage: USAGE },
			parts: [{ type: "text", text: "An old answer" }],
		},
	];

	it("lists them and reopens one, then continues it", async () => {
		server.runs = [{ id: "old-run", title: "An old question" }];
		server.run = { id: "old-run", title: "An old question", messages: stored };
		server.agent.push(() => stream(answer(text("continued"), { runId: "old-run" })));
		renderPanel();
		fireEvent.click(await screen.findByRole("button", { name: t("history.label") }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "An old question" }));

		expect(await screen.findByText("An old answer")).toBeTruthy();
		await ask("and then?");
		await screen.findByText("continued");
		expect(agentRequests()[0].runId).toBe("old-run");
		expect(agentRequests()[0].messages).toHaveLength(3);
	});

	it("says so when there are none", async () => {
		renderPanel();
		fireEvent.click(await screen.findByRole("button", { name: t("history.label") }));
		expect(await screen.findByText(t("history.empty"))).toBeTruthy();
	});

	it("picks up the conversation the admin left on the last screen", async () => {
		server.runs = [{ id: "old-run", title: "An old question" }];
		server.run = { id: "old-run", title: "An old question", messages: stored };
		server.agent.push(() => stream(answer(text("hello"), { runId: "old-run" })));
		const first = renderPanel();
		await ask("start");
		await screen.findByText("hello");
		first.unmount();

		renderPanel();
		expect(await screen.findByText("An old answer")).toBeTruthy();
	});

	it("does not replace what the admin already asked with the conversation it was still loading", async () => {
		window.localStorage.setItem(
			Object.keys(window.localStorage).find((key) => key.endsWith("agent-run")) ?? "cms:test:agent-run",
			"old-run",
		);
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const base = fetchMock.getMockImplementation();
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (String(input).includes("/v1/ai/agent/runs/")) {
				await gate;
				return json({ id: "old-run", title: "t", messages: stored });
			}
			return (base as (input: string, init?: RequestInit) => Promise<unknown>)(input, init);
		});
		server.agent.push(() => stream(answer(text("fresh answer"))));
		renderPanel();
		await ask("a new question");
		await screen.findByText("fresh answer");
		release();
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(screen.getByText("a new question")).toBeTruthy();
		expect(screen.queryByText("An old answer")).toBeNull();
	});

	it("forgets a remembered conversation that is gone", async () => {
		window.localStorage.setItem(
			Object.keys(window.localStorage).find((key) => key.endsWith("agent-run")) ?? "cms:test:agent-run",
			"gone",
		);
		renderPanel();
		await screen.findByRole("textbox", { name: t("input.label") });
		expect(screen.queryByRole("alert")).toBeNull();
	});
});

describe("assistant panel — editor tools", () => {
	const editor = (): OpenEditor => ({
		readEntry: () => ({
			collection: "post",
			entryId: "e1",
			slug: "hello",
			fields: { title: "An unsaved title", tags: ["a", "b"] },
			body: { type: "doc", version: 1, content: [] } as never,
			hasUnsavedChanges: true,
		}),
		readSelection: () => ({
			text: "picked words",
			block: { id: "blk1", type: "paragraph", text: "A paragraph with picked words" },
		}),
	});

	it("answers the editor tools from the open editor and lets the run go on with the answers", async () => {
		server.agent.push(
			() => stream(answer([...toolCall("r1", "editor_read", {}), ...toolCall("s1", "editor_selection", {})])),
			() => stream(answer(text("Your title is unsaved."))),
		);
		renderPanel({ context: { screen: "entry", collection: "post", entryId: "e1" }, editor: editor() });
		await ask("what is this?");
		expect(await screen.findByText("Your title is unsaved.")).toBeTruthy();

		expect(agentRequests()).toHaveLength(2);
		const [, followUp] = agentRequests();
		expect(followUp.context.entryId).toBe("e1");
		const parts = followUp.messages.at(-1).parts as Array<{
			type: string;
			state?: string;
			output?: Record<string, unknown>;
		}>;
		const read = parts.find((part) => part.type === "tool-editor_read");
		const selection = parts.find((part) => part.type === "tool-editor_selection");
		expect(read?.state).toBe("output-available");
		expect(read?.output).toMatchObject({
			collection: "post",
			entryId: "e1",
			slug: "hello",
			fields: { title: "An unsaved title", tags: ["a", "b"] },
			unsavedChanges: true,
		});
		expect(selection?.output).toEqual({
			text: "picked words",
			block: { id: "blk1", type: "paragraph", text: "A paragraph with picked words" },
		});
	});

	it("answers with an error, not silence, when the editor is not open any more", async () => {
		server.agent.push(
			() => stream(answer(toolCall("r1", "editor_read", {}))),
			() => stream(answer(text("I could not read it."))),
		);
		renderPanel({ context: { screen: "entry", entryId: "e1" } });
		await ask("read it");
		expect(await screen.findByText("I could not read it.")).toBeTruthy();
		const part = agentRequests()[1]
			.messages.at(-1)
			.parts.find((item: { type: string }) => item.type === "tool-editor_read");
		expect(part).toMatchObject({ state: "output-error", errorText: t("tool.noEditor") });
	});

	it("does not answer a tool of the server by itself", async () => {
		server.agent.push(() => stream(answer(toolCall("c1", "entries_list", {}, { total: 0 }))));
		renderPanel({ editor: editor() });
		await ask("list");
		await screen.findByRole("button", { name: /entries\.list/ });
		await waitFor(() => expect(screen.queryByRole("button", { name: t("stop") })).toBeNull());
		expect(agentRequests()).toHaveLength(1);
	});
});

describe("assistant panel — when it cannot run", () => {
	const link = () => screen.getByRole("link", { name: t("unavailable.link") });

	it("says there is no connection, with a link to the AI screen, and keeps the box off", async () => {
		server.settings = settings({ agent: { setting: null, effective: null } });
		renderPanel();
		expect(await screen.findByText(includes(t("unavailable.noConnection")))).toBeTruthy();
		expect(screen.getByText(includes(t("unavailable.noConnection.fix")))).toBeTruthy();
		expect(link().getAttribute("href")).toBe(testSite.adminHref("/tools/ai"));
		expect(screen.getByRole("textbox", { name: t("input.label") })).toBeDisabled();
		expect(screen.getByRole("button", { name: t("send") })).toBeDisabled();
	});

	it("says the model can't call tools, naming it, when the connection check found that out", async () => {
		server.settings = settings({
			agent: {
				setting: null,
				effective: { providerId: "p1", providerName: "Main", model: "small-model", tools: false },
			},
		});
		renderPanel();
		expect(await screen.findByText(includes(t("unavailable.noTools", { model: "small-model" })))).toBeTruthy();
		expect(link().getAttribute("href")).toBe(testSite.adminHref("/tools/ai"));
	});

	it("still works for a model that was never checked, and for the development connection", async () => {
		server.settings = settings({
			fake: true,
			agent: { setting: null, effective: null },
		});
		server.agent.push(() => stream(answer(text("fine"))));
		renderPanel();
		await ask("hi");
		expect(await screen.findByText("fine")).toBeTruthy();
		expect(screen.queryByRole("link", { name: t("unavailable.link") })).toBeNull();
	});

	it("learns it from the server's refusal (`agent_unavailable`) when the settings did not say", async () => {
		server.agent.push(() => refusal("agent_unavailable", 422));
		renderPanel();
		await ask("hi");
		expect(await screen.findByText(includes(t("unavailable.noTools", { model: "big-model" })))).toBeTruthy();
		expect(link()).toBeTruthy();
	});

	it("learns there is no connection from the server's refusal (`service_unavailable`)", async () => {
		server.agent.push(() => refusal("service_unavailable", 503));
		renderPanel();
		await ask("hi");
		expect(await screen.findByText(includes(t("unavailable.noConnection")))).toBeTruthy();
	});

	it("tells another failure apart: it says so and offers to try again", async () => {
		server.agent.push(
			() =>
				stream([
					{ type: "start", messageId: "m" },
					{ type: "error", errorText: "provider down" },
				]),
			() => stream(answer(text("back again"))),
		);
		renderPanel();
		await ask("hi");
		expect(await screen.findByText(t("error.failed"))).toBeTruthy();
		expect(screen.queryByRole("link", { name: t("unavailable.link") })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: t("error.retry") }));
		expect(await screen.findByText("back again")).toBeTruthy();
	});
});
