import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { jsonResponse as json } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { toast } from "../../../test/ui-toast";
import { AdminShell } from "../../shared/admin-shell";
import { AdminQueryProvider } from "../../shared/query-provider";
import { EventsScreen } from "../events-screen";
import { eventsMessages } from "../messages";

const t = testSite.createTranslator(eventsMessages);

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const counts = { pending: 0, delivering: 0, delivered: 5, failed: 1, dead: 1, dismissed: 0 };
const item = (
	eventId: string,
	subscriber: string | null,
	state: "failed" | "dead" | "delivered" | "pending" | "recorded",
	kind = "published",
) => ({
	change: {
		eventId,
		kind,
		entryId: `entry-${eventId}`,
		collection: "post",
		occurredAt: "2026-01-01T00:00:00.000Z",
		workingSlug: `slug-${eventId}`,
		...(kind === "deleted" ? { title: `Title ${eventId}` } : {}),
	},
	subscriber,
	state,
	attempts: 3,
	lastError: state === "failed" || state === "dead" ? "boom" : null,
	nextAttemptAt: state === "failed" ? "2026-01-02T00:00:00.000Z" : null,
});

let fetchMock: ReturnType<typeof vi.fn>;

// The filter and page live in the address, so every test gets an address of its own.
let render: ReturnType<typeof createTestRouter>["render"];
beforeEach(() => {
	render = createTestRouter().render;
	vi.clearAllMocks();
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const method = init?.method ?? "GET";
		if (method === "GET" && input.startsWith("/api/monti/v1/events?"))
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
			<AdminShell title="Events" sidebar={{ activeNav: "events" }}>
				<EventsScreen />
			</AdminShell>
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
		// A deleted entry is named by the title the event kept, as plain text (there is nothing to link to).
		expect(within(deadRow).getByText("Title e2").closest("a")).toBeNull();
		expect(within(deadRow).queryByText("entry-e2")).toBeNull();
		expect(within(failedRow).getByText("slug-e1").closest("a")).not.toBeNull();
	});

	it("opens the full record of an event from its row without breaking the row's own actions", async () => {
		renderScreen();

		const row = (await screen.findByText("webhook")).closest("tr") as HTMLElement;
		fireEvent.click(within(row).getByText("Title e2"));
		const detail = await screen.findByRole("dialog");
		expect(within(detail).getByText("entry-e2")).toBeTruthy();
		expect(within(detail).getByText("e2")).toBeTruthy();
		expect(within(detail).getByText("webhook")).toBeTruthy();
		expect(within(detail).getByText("boom")).toBeTruthy();
		fireEvent.keyDown(detail, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		// Retry in the row still retries and does not open the detail.
		fireEvent.click(within(row).getByRole("button", { name: t("action.retryLabel", { subscriber: "webhook" }) }));
		await waitFor(() => expect(posts().length).toBe(1));
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("labels an event with no subscribers as recorded, with no retry or dismiss", async () => {
		fetchMock.mockImplementation(async () =>
			json({ items: [item("e3", null, "recorded", "saved")], total: 1, counts }),
		);
		renderScreen();

		const row = (await screen.findByText("slug-e3")).closest("tr") as HTMLElement;
		expect(within(row).getByText(t("state.recorded"))).toBeTruthy();
		expect(within(row).queryByText(t("state.pending"))).toBeNull();
		expect(within(row).queryByText(t("state.failed"))).toBeNull();
		expect(within(row).queryByRole("button", { name: /Retry|Dismiss|다시 시도|무시/ })).toBeNull();
	});

	it("with no subscriber on any row, leaves out the delivery columns", async () => {
		fetchMock.mockImplementation(async () =>
			json({ items: [item("e3", null, "recorded", "saved")], total: 1, counts }),
		);
		renderScreen();

		await screen.findByText("slug-e3");
		for (const column of ["column.subscriber", "column.attempts", "column.lastError", "column.nextAttempt"] as const) {
			expect(screen.queryByRole("columnheader", { name: t(column) })).toBeNull();
		}
		expect(screen.getByRole("columnheader", { name: t("column.when") })).toBeTruthy();
	});

	it("keeps the delivery columns while some row has a subscriber", async () => {
		renderScreen();

		await screen.findByText("search-index");
		for (const column of ["column.subscriber", "column.attempts", "column.lastError", "column.nextAttempt"] as const) {
			expect(screen.getByRole("columnheader", { name: t(column) })).toBeTruthy();
		}
	});

	it("names the collection of an event by its label, not its key", async () => {
		renderScreen();

		const row = (await screen.findByText("search-index")).closest("tr") as HTMLElement;
		expect(within(row).getByText(testSite.COLLECTION_DEFINITIONS.post.label, { exact: false })).toBeTruthy();
	});

	it("retries one delivery with its subscriber", async () => {
		renderScreen();
		fireEvent.click(
			await screen.findByRole("button", { name: t("action.retryLabel", { subscriber: "search-index" }) }),
		);

		await waitFor(() => expect(posts()).toEqual([["/api/monti/v1/events/e1/retry", { subscriber: "search-index" }]]));
	});

	it("asks before dismissing, then posts", async () => {
		renderScreen();
		fireEvent.click(await screen.findByRole("button", { name: t("action.dismissLabel", { subscriber: "webhook" }) }));

		expect(posts()).toEqual([]);
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: t("action.dismiss") }));

		await waitFor(() => expect(posts()).toEqual([["/api/monti/v1/events/e2/dismiss", { subscriber: "webhook" }]]));
	});

	it("retries everything due", async () => {
		let retried = false;
		fetchMock.mockImplementation(async (_input: string, init?: RequestInit) => {
			if (init?.method === "POST") {
				retried = true;
				return json({ delivered: 1, failed: 0, dead: 0, counts });
			}
			return retried
				? json({ items: [], total: 0, counts: { ...counts, failed: 0 } })
				: json({ items: [item("e1", "search-index", "failed")], total: 1, counts });
		});
		renderScreen();
		fireEvent.click(await screen.findByRole("button", { name: t("action.retryAll") }));

		await waitFor(() => expect(posts()).toEqual([["/api/monti/v1/events/retry", {}]]));
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(await screen.findByText(t("list.emptyYet"))).toBeTruthy();
		// Nothing pending or failed is left to retry.
		expect(screen.queryByRole("button", { name: t("action.retryAll") })).toBeNull();
	});

	it("offers no retry when nothing is pending or failed, even with events listed", async () => {
		fetchMock.mockImplementation(async () =>
			json({
				items: [item("e3", null, "recorded", "saved"), item("e4", "webhook", "delivered")],
				total: 2,
				counts: { ...counts, failed: 0, dead: 2 },
			}),
		);
		renderScreen();
		expect(await screen.findByText("slug-e3")).toBeTruthy();
		expect(screen.queryByRole("button", { name: t("action.retryAll") })).toBeNull();
	});

	it("opens on all recent events, not only the failed ones", async () => {
		fetchMock.mockImplementation(async () =>
			json({
				items: [item("e3", "search-index", "delivered", "saved"), item("e1", "webhook", "failed")],
				total: 2,
				counts,
			}),
		);
		renderScreen();

		const deliveredRow = (await screen.findByText("slug-e3")).closest("tr") as HTMLElement;
		expect(within(deliveredRow).getByText(t("state.delivered"))).toBeTruthy();
		expect(within(deliveredRow).getByText(t("kind.saved"))).toBeTruthy();
		// A delivered event has nothing to retry or dismiss; a failed one does.
		expect(within(deliveredRow).queryByRole("button", { name: /Retry|Dismiss|다시 시도|무시/ })).toBeNull();
		const failedRow = screen.getByText("slug-e1").closest("tr") as HTMLElement;
		expect(within(failedRow).getAllByRole("button", { name: /Retry|Dismiss|다시 시도|무시/ })).toHaveLength(2);
		const url = new URL(
			String(fetchMock.mock.calls.map(([input]) => input).find((input) => String(input).includes("state="))),
			"http://localhost",
		);
		expect(url.searchParams.getAll("state")).toEqual(
			expect.arrayContaining(["pending", "delivered", "failed", "dead"]),
		);
	});

	it("filters by delivery status and returns to all from the empty state", async () => {
		// The sidebar's failed-delivery count is a request without a state; the list is the one that names states.
		const requested = () =>
			fetchMock.mock.calls
				.map(([input]) => new URL(String(input), "http://localhost").searchParams.getAll("state"))
				.filter((states) => states.length > 0);
		fetchMock.mockImplementation(async (input: string) => {
			const states = new URL(input, "http://localhost").searchParams.getAll("state");
			const onlyFailed = states.length === 2 && states.includes("failed");
			return json({
				items: onlyFailed ? [] : [item("e3", "search-index", "delivered")],
				total: onlyFailed ? 0 : 1,
				counts,
			});
		});
		renderScreen();
		await screen.findByText("search-index");

		fireEvent.click(screen.getByRole("tab", { name: t("filter.failed") }));
		expect(await screen.findByText(t("list.emptyNoMatch"))).toBeTruthy();
		expect(requested().at(-1)?.sort()).toEqual(["dead", "failed"]);

		fireEvent.click(screen.getByRole("button", { name: t("list.clearFilters") }));
		expect(await screen.findByText("search-index")).toBeTruthy();
		expect(requested().at(-1)).toEqual(expect.arrayContaining(["pending", "delivered", "failed", "dead", "recorded"]));
	});

	it("shows the status as the first column and marks the picked status tab", async () => {
		renderScreen();
		const row = (await screen.findByText("search-index")).closest("tr") as HTMLElement;

		const headers = screen.getAllByRole("columnheader");
		expect(headers[0]?.textContent).toBe(t("column.state"));
		expect(within(row).getAllByRole("cell")[0]?.textContent).toBe(t("state.failed"));
		expect(screen.getByRole("tab", { name: t("filter.all") }).getAttribute("aria-selected")).toBe("true");

		fireEvent.click(screen.getByRole("tab", { name: t("filter.delivered") }));
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: t("filter.delivered") }).getAttribute("aria-selected")).toBe("true"),
		);
		expect(screen.getByRole("tab", { name: t("filter.all") }).getAttribute("aria-selected")).toBe("false");
	});

	it("pages through the events", async () => {
		fetchMock.mockImplementation(async (input: string) => {
			const offset = Number(new URL(input, "http://localhost").searchParams.get("offset"));
			return json({ items: [item(`e${offset}`, "webhook", "delivered")], total: 60, counts });
		});
		renderScreen();
		await screen.findByText("slug-e0");

		fireEvent.click(screen.getByRole("link", { name: /Next page|다음 페이지/ }));
		expect(await screen.findByText("slug-e25")).toBeTruthy();
	});
});
