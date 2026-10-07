import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { renderWithSite as render } from "../../__test__/site-wrapper";
import { AdminQueryProvider } from "../../shared/query-provider";
import { EventsScreen } from "../events-screen";
import { eventsMessages } from "../messages";

const t = testSite.createTranslator(eventsMessages);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ Toaster: () => null, toast }));
vi.mock("../../admin-sidebar", () => ({ AdminSidebar: () => null }));
vi.mock("../../../router", () => ({
	AdminLink: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const counts = { pending: 0, delivering: 0, delivered: 5, failed: 1, dead: 1, dismissed: 0 };
const item = (eventId: string, subscriber: string, state: "failed" | "dead", kind = "published") => ({
	change: {
		eventId,
		kind,
		entryId: `entry-${eventId}`,
		collection: "post",
		occurredAt: "2026-01-01T00:00:00.000Z",
		workingSlug: `slug-${eventId}`,
	},
	subscriber,
	state,
	attempts: 3,
	lastError: "boom",
	nextAttemptAt: state === "failed" ? "2026-01-02T00:00:00.000Z" : null,
});
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const method = init?.method ?? "GET";
		if (method === "GET" && input.startsWith("/api/cms/v1/events?"))
			return json({
				items: [item("e1", "search-index", "failed"), item("e2", "webhook", "dead", "deleted")],
				total: 2,
				counts,
			});
		if (method === "POST") return json({ counts });
		throw new Error(`Unexpected fetch ${method} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderScreen = () =>
	render(
		<AdminQueryProvider>
			<EventsScreen />
		</AdminQueryProvider>,
	);

const posts = () =>
	fetchMock.mock.calls
		.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
		.map(([url, init]) => [url, JSON.parse(String((init as RequestInit).body))]);

describe("EventsScreen", () => {
	it("lists failed and dead deliveries with subscriber and state", async () => {
		renderScreen();

		const failedRow = (await screen.findByText("search-index")).closest("tr") as HTMLElement;
		const deadRow = screen.getByText("webhook").closest("tr") as HTMLElement;
		expect(within(failedRow).getByText(t("state.failed"))).toBeTruthy();
		expect(within(deadRow).getByText(t("state.dead"))).toBeTruthy();
		// A deleted entry shows only its id.
		expect(within(deadRow).getByText("entry-e2").closest("a")).toBeNull();
		expect(within(failedRow).getByText("slug-e1").closest("a")).not.toBeNull();
	});

	it("retries one delivery with its subscriber", async () => {
		renderScreen();
		fireEvent.click(
			await screen.findByRole("button", { name: t("action.retryLabel", { subscriber: "search-index" }) }),
		);

		await waitFor(() => expect(posts()).toEqual([["/api/cms/v1/events/e1/retry", { subscriber: "search-index" }]]));
	});

	it("asks before dismissing, then posts", async () => {
		renderScreen();
		fireEvent.click(await screen.findByRole("button", { name: t("action.dismissLabel", { subscriber: "webhook" }) }));

		expect(posts()).toEqual([]);
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: t("action.dismiss") }));

		await waitFor(() => expect(posts()).toEqual([["/api/cms/v1/events/e2/dismiss", { subscriber: "webhook" }]]));
	});

	it("retries everything due", async () => {
		fetchMock.mockImplementation(async (_input: string, init?: RequestInit) => {
			if (init?.method === "POST") return json({ delivered: 1, failed: 0, dead: 0, counts });
			return json({ items: [], total: 0, counts });
		});
		renderScreen();
		fireEvent.click(await screen.findByRole("button", { name: t("action.retryAll") }));

		await waitFor(() => expect(posts()).toEqual([["/api/cms/v1/events/retry", {}]]));
		await waitFor(() => expect(toast.success).toHaveBeenCalled());
		expect(await screen.findByText(t("list.empty"))).toBeTruthy();
	});
});
