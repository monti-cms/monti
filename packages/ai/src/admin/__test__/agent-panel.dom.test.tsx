import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenContextProvider, usePublishScreenContext } from "../../../../admin/src/screens/shared/screen-context";
import { createTestRouter } from "../../../../admin/src/test/router";
import { SiteWrapper } from "../../../../admin/src/test/site";
import { testSite } from "../../../test/site";
import type { AiSettingsView } from "../../connection";
import { AgentPanel } from "../agent-panel";
import { agentPanelMessages } from "../agent-panel.messages";

const t = testSite.createTranslator(agentPanelMessages);
const { render: renderRouted } = createTestRouter();

type Chunk = Record<string, unknown>;
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
/** The AI SDK's UI message stream, as the server writes it; `cut` ends it with a failure instead of the end. */
const stream = (chunks: Chunk[], { cut = false }: { cut?: boolean } = {}) =>
	new Response(
		new ReadableStream({
			start(controller) {
				const encoder = new TextEncoder();
				for (const chunk of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
				if (cut)
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", errorText: "terminated" })}\n\n`));
				else controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			},
		}),
		{ headers: { "content-type": "text/event-stream" } },
	);
const listRead: Chunk[] = [
	{ type: "start", messageId: "m1", messageMetadata: { runId: "run-1" } },
	{ type: "start-step" },
	{ type: "tool-input-available", toolCallId: "c1", toolName: "entries_list", input: { collection: "post" } },
	{ type: "tool-output-available", toolCallId: "c1", output: { items: [], total: 148 } },
];
const answered: Chunk[] = [
	...listRead,
	{ type: "text-start", id: "t" },
	{ type: "text-delta", id: "t", delta: "두 편이에요." },
	{ type: "text-end", id: "t" },
	{ type: "finish-step" },
	{ type: "finish", messageMetadata: { runId: "run-1" } },
];

const settings: AiSettingsView = {
	version: 1,
	keys: [{ id: "a", name: "Anthropic 개인", service: "anthropic", ready: true }],
	quick: { keyId: "a", model: "claude-haiku-5-5", keyName: "Anthropic 개인" },
	assistant: { keyId: "a", model: "claude-sonnet-5-5", keyName: "Anthropic 개인" },
	toolSupport: {},
	fake: false,
	unopenedDays: 30,
};
const run = (id: string, title: string) => ({
	id,
	title,
	status: "done",
	usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
});

const server = {
	runs: [] as ReturnType<typeof run>[],
	agent: [] as Array<() => Response>,
	deleted: [] as string[],
};
let fetchMock: ReturnType<typeof vi.fn>;
const agentRequests = () =>
	fetchMock.mock.calls
		.filter(([input, init]) => String(input).endsWith("/v1/ai/agent") && init?.method === "POST")
		.map(([, init]) => JSON.parse(String((init as RequestInit).body)));

beforeEach(() => {
	window.localStorage.clear();
	server.runs = [];
	server.agent = [];
	server.deleted = [];
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = String(input);
		if (url.endsWith("/v1/ai/settings")) return json(settings);
		if (url.includes("/v1/ai/agent/runs?")) return json({ items: server.runs, total: server.runs.length });
		if (url.includes("/v1/ai/agent/runs/") && init?.method === "DELETE") {
			server.deleted.push(decodeURIComponent(url.split("/").at(-1) ?? ""));
			return json({ deleted: true });
		}
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

function Where({ context }: { context: Parameters<typeof usePublishScreenContext>[0] }) {
	usePublishScreenContext(context);
	return null;
}
const renderPanel = (
	context: Parameters<typeof usePublishScreenContext>[0] = { screen: "entries", collection: "post" },
) =>
	renderRouted(
		<SiteWrapper>
			<ScreenContextProvider>
				<Where context={context} />
				<AgentPanel onClose={() => undefined} />
			</ScreenContextProvider>
		</SiteWrapper>,
	);

describe("assistant panel", () => {
	it("ASSIST-P1 offers this screen's default requests and the recent ones, and pressing one asks it", async () => {
		server.runs = [run("r1", "쓰지 않는 태그 정리해 줘")];
		server.agent.push(() => stream(answered));
		renderPanel();
		const start = await screen.findByTestId("agent-start");
		expect(within(start).getByText(t("requests.entries"))).toBeInTheDocument();
		await within(start).findByRole("button", { name: "쓰지 않는 태그 정리해 줘" });
		fireEvent.click(within(start).getByRole("button", { name: t("requests.entries.emptySummary") }));
		await screen.findByText("두 편이에요.");
		expect(screen.getByText("글 목록 읽음 · 게시글 148편")).toBeInTheDocument();
		const [request] = agentRequests();
		expect(request.messages.at(-1).parts[0].text).toBe(t("requests.entries.emptySummary"));
	});

	it("ASSIST-P2 sends the picked rows with the request and shows them on the box; × leaves them out", async () => {
		server.agent.push(
			() => stream(answered),
			() => stream(answered),
		);
		renderPanel({ screen: "entries", collection: "post", selectedIds: ["a", "b"] });
		const chip = await screen.findByText(t("picked.entries", { count: 2 }));
		expect(chip).toBeInTheDocument();
		fireEvent.click(await screen.findByRole("button", { name: t("requests.entries.oldDrafts") }));
		await screen.findByText("두 편이에요.");
		expect(agentRequests()[0].context.selectedIds).toEqual(["a", "b"]);
		fireEvent.click(screen.getByRole("button", { name: t("picked.remove") }));
		expect(screen.queryByRole("button", { name: t("picked.remove") })).not.toBeInTheDocument();
		const box = screen.getByRole("textbox", { name: t("input.label") });
		fireEvent.change(box, { target: { value: "다른 건?" } });
		fireEvent.click(screen.getByRole("button", { name: t("send") }));
		await waitFor(() => expect(agentRequests()).toHaveLength(2));
		expect(agentRequests()[1].context.selectedIds).toBeUndefined();
	});

	it("ASSIST-P3 keeps what a cut answer got done, marks the call it stopped in, and goes on from there", async () => {
		server.agent.push(
			() =>
				stream(
					[
						...listRead,
						{ type: "tool-input-available", toolCallId: "c2", toolName: "entries_get", input: { id: "x" } },
					],
					{ cut: true },
				),
			() => stream(answered),
		);
		renderPanel();
		fireEvent.click(await screen.findByRole("button", { name: t("requests.entries.emptySummary") }));
		await screen.findByText(t("cut.title"));
		expect(screen.getByText("글 목록 읽음 · 게시글 148편")).toBeInTheDocument();
		expect(screen.getByText("글 읽기 · 여기서 멈춤")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: t("cut.action") }));
		await waitFor(() => expect(agentRequests()).toHaveLength(2));
		// It goes on with the same conversation and nothing new from the admin: the answer so far is the last message.
		const [, again] = agentRequests();
		expect(again.messages.at(-1).role).toBe("assistant");
		expect(again.messages.filter((message: { role: string }) => message.role === "user")).toHaveLength(1);
	});

	it("ASSIST-H1 lists the past conversations in the panel and deletes one from its menu", async () => {
		server.runs = [run("r1", "쓰지 않는 태그 정리해 줘"), run("r2", "지난달 많이 읽힌 글 알려 줘")];
		renderPanel();
		fireEvent.click(await screen.findByRole("button", { name: t("history.label") }));
		const list = await screen.findByTestId("agent-history");
		await within(list).findByText("쓰지 않는 태그 정리해 줘");
		fireEvent.click(
			within(list).getByRole("button", { name: t("history.menu", { title: "쓰지 않는 태그 정리해 줘" }) }),
		);
		fireEvent.click(await screen.findByRole("menuitem", { name: t("history.delete") }));
		await waitFor(() => expect(within(list).queryByText("쓰지 않는 태그 정리해 줘")).not.toBeInTheDocument());
		expect(server.deleted).toEqual(["r1"]);
		expect(within(list).getByText("지난달 많이 읽힌 글 알려 줘")).toBeInTheDocument();
	});
});
