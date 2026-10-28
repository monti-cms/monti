// @vitest-environment jsdom

import { AdminComponentsProvider } from "@monti-cms/admin";
import { TooltipProvider } from "@monti-cms/admin/kit";
import { type AdminRouter, AdminRouterProvider } from "@monti-cms/admin/router";
import { useSlot } from "@monti-cms/admin/slots";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "@monti-cms/core/document";
import { createMdxBrowserFormat } from "@monti-cms/mdx/admin";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteWrapper } from "../../../../admin/src/test/site";
import { testSite } from "../../../test/site";
import { AiSlotProvider } from "../ai-slot-provider";

/** The host router of the admin, standing still at one address. */
const routerAt = (pathname: string): AdminRouter => ({
	Link: (props) => <a {...props} />,
	navigate: () => {},
	replace: () => {},
	usePathname: () => pathname,
	useSearchParams: () => new URLSearchParams(),
});
const hostRouter = routerAt(testSite.adminHref());

const mdxBrowserFormat = createMdxBrowserFormat(testSite);

/** Checks only how a screen slot receives the AI action. The list response is fake. */
const view = (key: string, label: string) => ({
	key,
	label,
	enabled: true,
	apply: "replace",
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

function renderPlace(router: AdminRouter = hostRouter) {
	render(
		<SiteWrapper site={testSite}>
			<AdminRouterProvider router={router}>
				<TooltipProvider>
					<AiSlotProvider>
						<Place />
					</AiSlotProvider>
				</TooltipProvider>
			</AdminRouterProvider>
		</SiteWrapper>,
	);
}

describe("AI slot source", () => {
	it("gives an action the fill button, which carries the action's name", async () => {
		renderPlace();
		const fill = await screen.findByRole("button", { name: "Fill" });
		expect(fill.getAttribute("title")).toBe("Suggest titles");
	});

	it("leaves out an action that only shows a note, which has nothing to put in a field", async () => {
		items = [{ ...view("a", "Explain"), apply: "none" }];
		renderPlace();
		await waitFor(() => expect(fetch).toHaveBeenCalled());
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("asks for no actions on the login screen, which the host router reports", async () => {
		renderPlace(routerAt(testSite.adminHref("/login")));
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(fetch).not.toHaveBeenCalled();
		expect(screen.queryByRole("button", { name: "Fill" })).toBeNull();
	});

	it("lists several actions in one menu opened by the fill button", async () => {
		items = [view("a", "Suggest titles"), view("b", "Write summary")];
		renderPlace();
		fireEvent.click(await screen.findByRole("button", { name: "Fill" }));
		await waitFor(() =>
			expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
				"Suggest titles",
				"Write summary",
			]),
		);
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
			<SiteWrapper site={testSite}>
				<AdminRouterProvider router={hostRouter}>
					<TooltipProvider>
						<AdminComponentsProvider components={withFormat ? { formats: { mdx: mdxBrowserFormat } } : {}}>
							<AiSlotProvider>
								<Body />
							</AiSlotProvider>
						</AdminComponentsProvider>
					</TooltipProvider>
				</AdminRouterProvider>
			</SiteWrapper>,
		);
	}

	const bodyAction = () => ({ ...view("a", "Suggest titles"), input: { body: {} } });

	function stubFetch() {
		const fetchMock = vi.fn(async (url: string) =>
			String(url).endsWith("/v1/ai/run")
				? { ok: true, status: 200, json: async () => ({ result: { kind: "text", text: "제목" } }) }
				: { ok: true, status: 200, json: async () => ({ usable: ["a"], items: [bodyAction()] }) },
		);
		vi.stubGlobal("fetch", fetchMock);
		return fetchMock;
	}

	it("is sent as MDX, written from the document by the mdx format", async () => {
		const fetchMock = stubFetch();
		renderBody(true);
		fireEvent.click(await screen.findByRole("button", { name: "Fill" }));
		await waitFor(() => expect(runCalls(fetchMock)).toHaveLength(1));
		const sent = JSON.parse(String(runCalls(fetchMock)[0]?.[1]?.body)) as { input: { body?: string } };
		expect(sent.input.body).toBe(mdxBrowserFormat.export(body).trim());
		expect(sent.input.body).toContain("첫째 문단");
	});

	it("is left out when no mdx format is registered, instead of sending the document", async () => {
		const fetchMock = stubFetch();
		renderBody(false);
		fireEvent.click(await screen.findByRole("button", { name: "Fill" }));
		await waitFor(() => expect(runCalls(fetchMock)).toHaveLength(1));
		const sent = JSON.parse(String(runCalls(fetchMock)[0]?.[1]?.body)) as { input: Record<string, unknown> };
		expect(sent.input).not.toHaveProperty("body");
	});
});
