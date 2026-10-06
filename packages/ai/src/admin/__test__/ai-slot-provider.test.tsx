// @vitest-environment jsdom

import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { mdxBrowserFormat } from "@monti-cms/admin/editor";
import { TooltipProvider } from "@monti-cms/admin/kit";
import { useSlot } from "@monti-cms/admin/slots";
import { createTranslator } from "@monti-cms/core/client";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "@monti-cms/core/document";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiCommonMessages } from "../ai-common.messages";
import { AiSlotProvider } from "../ai-slot-provider";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

const t = createTranslator(aiCommonMessages);

/** Checks only how a screen slot receives the AI action. The list response is fake. */
const view = (key: string, label: string) => ({
	key,
	label,
	enabled: true,
	apply: "replace",
	askInstruction: false,
	instant: false,
	attach: [{ slot: "field", field: "title" }],
});

let items: ReturnType<typeof view>[] = [];

beforeEach(() => {
	items = [view("a", "Suggest titles")];
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => ({ usable: items.map((item) => item.key), items }),
		})),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function Place() {
	const { trigger } = useSlot({ slot: "field", target: "title", getContext: () => ({}), apply: () => {} });
	return <span data-testid="trigger">{trigger}</span>;
}

function renderPlace() {
	render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
			<TooltipProvider>
				<AiSlotProvider>
					<Place />
				</AiSlotProvider>
			</TooltipProvider>
		</QueryClientProvider>,
	);
}

describe("AI slot source", () => {
	it("gives each action a button with its own label", async () => {
		renderPlace();
		expect(await screen.findByRole("button", { name: "Suggest titles" })).toBeTruthy();
	});

	it("groups several actions in one menu named AI", async () => {
		items = [view("a", "Suggest titles"), view("b", "Write summary")];
		renderPlace();
		const menu = await screen.findByRole("button", { name: t("slotMenu") });
		fireEvent.click(menu);
		await waitFor(() => expect(screen.getAllByRole("menuitem")).toHaveLength(2));
	});
});

describe("the body an action reads", () => {
	const body: StoredDocument = {
		type: "doc",
		version: STORED_DOCUMENT_VERSION,
		content: [{ type: "paragraph", id: "abcd1234", content: [{ type: "text", text: "첫째 문단" }] }],
	};

	function Body() {
		const { trigger } = useSlot({
			slot: "field",
			target: "title",
			getContext: () => ({ body }),
			apply: () => {},
		});
		return <span data-testid="trigger">{trigger}</span>;
	}

	const runCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
		fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/v1/ai/run"));

	function renderBody(withFormat: boolean) {
		render(
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<TooltipProvider>
					<CmsAdminComponentsProvider components={withFormat ? { formats: { mdx: mdxBrowserFormat } } : {}}>
						<AiSlotProvider>
							<Body />
						</AiSlotProvider>
					</CmsAdminComponentsProvider>
				</TooltipProvider>
			</QueryClientProvider>,
		);
	}

	const instantAction = () => ({ ...view("a", "Suggest titles"), instant: true, input: { body: {} } });

	function stubFetch() {
		const fetchMock = vi.fn(async (url: string) =>
			String(url).endsWith("/v1/ai/run")
				? { ok: true, status: 200, json: async () => ({ result: { kind: "text", text: "제목" } }) }
				: { ok: true, status: 200, json: async () => ({ usable: ["a"], items: [instantAction()] }) },
		);
		vi.stubGlobal("fetch", fetchMock);
		return fetchMock;
	}

	it("is sent as MDX, written from the document by the mdx format", async () => {
		const fetchMock = stubFetch();
		renderBody(true);
		fireEvent.click(await screen.findByRole("button", { name: "Suggest titles" }));
		await waitFor(() => expect(runCalls(fetchMock)).toHaveLength(1));
		const sent = JSON.parse(String(runCalls(fetchMock)[0]?.[1]?.body)) as { input: { body?: string } };
		expect(sent.input.body).toBe(mdxBrowserFormat.export(body).trim());
		expect(sent.input.body).toContain("첫째 문단");
	});

	it("is left out when no mdx format is registered, instead of sending the document", async () => {
		const fetchMock = stubFetch();
		renderBody(false);
		fireEvent.click(await screen.findByRole("button", { name: "Suggest titles" }));
		await waitFor(() => expect(runCalls(fetchMock)).toHaveLength(1));
		const sent = JSON.parse(String(runCalls(fetchMock)[0]?.[1]?.body)) as { input: Record<string, unknown> };
		expect(sent.input).not.toHaveProperty("body");
	});
});
