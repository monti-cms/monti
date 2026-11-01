import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import type { EventCounts, EventDeliveryItem, EventsList } from "../../../api/events";
import { commonMessages } from "../../../lib/common.messages";
import { type FakeApi, fakeApi } from "../../../test/fake-api";
import { createTestRouter } from "../../../test/router";
import { toast } from "../../../test/ui-toast";
import { AdminUiLabels } from "../../../ui/labels";
import { AdminQueryProvider } from "../../shared/query-provider";
import { EventsScreen } from "../events-screen";
import { eventsMessages } from "../messages";

const t = testSite.createTranslator(eventsMessages);
const tc = testSite.createTranslator(commonMessages);

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const counts: EventCounts = { pending: 0, delivering: 0, delivered: 5, failed: 1, dead: 1, dismissed: 0 };
const item = (
	eventId: string,
	subscriber: string | null,
	state: "failed" | "dead" | "delivered" | "pending" | "recorded",
	kind: EventDeliveryItem["change"]["kind"] = "published",
): EventDeliveryItem => ({
	change: {
		eventId,
		kind,
		entryId: `entry-${eventId}`,
		collection: contentCollection,
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

let api: FakeApi;
/** Answers every list request with `list`. */
const listing = (list: (query: URLSearchParams) => EventsList) => api.on("GET /v1/events", ({ query }) => list(query));

// The filter and page live in the address, so every test gets an address of its own.
let render: ReturnType<typeof createTestRouter>["render"];
beforeEach(() => {
	render = createTestRouter().render;
	vi.clearAllMocks();
	api = fakeApi()
		.on("GET /v1/events", () => ({
			items: [item("e1", "search-index", "failed"), item("e2", "webhook", "dead", "deleted")],
			total: 2,
			counts,
		}))
		// The rail's count of the trash.
		.on("GET /v1/trash", () => ({ items: [], total: 0, kinds: {} }))
		.on("POST /v1/events/:id/retry", () => ({ counts }))
		.on("POST /v1/events/:id/dismiss", () => ({ counts }))
		.install();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderScreen = () =>
	render(
		<AdminUiLabels>
			<AdminQueryProvider>
				<EventsScreen />
			</AdminQueryProvider>
		</AdminUiLabels>,
	);
/** The row of the list that shows `text` (a subscriber, an address). */
const rowWith = (text: string) => screen.findByRole("row", { name: new RegExp(text) });
/** The retry and dismiss of a delivery, by the subscriber they name. */
const deliveryActions = (subscriber: string) => [
	{ name: t("action.retryLabel", { subscriber }) },
	{ name: t("action.dismissLabel", { subscriber }) },
];

const posts = () =>
	api.requests.filter((request) => request.method === "POST").map((request) => [request.path, request.body]);

describe("EventsScreen", () => {
	it("EVENT-L2 opens the full record of an event beside the list without breaking the row's own actions", async () => {
		renderScreen();

		const row = await rowWith("webhook");
		fireEvent.click(within(row).getByText("Title e2"));
		// A panel beside the list, not a dialog over it: the list stays usable and in place.
		const detail = await screen.findByRole("complementary", { name: /Title e2/ });
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(within(detail).getByText("entry-e2")).toBeInTheDocument();
		expect(within(detail).getByText("e2")).toBeInTheDocument();
		expect(within(detail).getByText("webhook")).toBeInTheDocument();
		expect(within(detail).getByText("boom")).toBeInTheDocument();
		fireEvent.click(within(detail).getByRole("button", { name: tc("close") }));
		expect(screen.queryByRole("complementary")).toBeNull();

		// Retry in the row still retries and does not open the detail.
		fireEvent.click(within(row).getByRole("button", { name: t("action.retryLabel", { subscriber: "webhook" }) }));
		await waitFor(() => expect(posts().length).toBe(1));
		expect(screen.queryByRole("complementary")).toBeNull();
	});

	it("EVENT-L1 labels an event with no subscribers as recorded, with no retry or dismiss", async () => {
		listing(() => ({ items: [item("e3", null, "recorded", "saved")], total: 1, counts }));
		renderScreen();

		const row = await rowWith("slug-e3");
		expect(within(row).getByText(t("state.recorded"))).toBeInTheDocument();
		expect(within(row).queryByText(t("state.pending"))).toBeNull();
		expect(within(row).queryByText(t("state.failed"))).toBeNull();
		for (const action of deliveryActions("")) expect(within(row).queryByRole("button", action)).toBeNull();
	});

	it("EVENT-R1 retries one delivery with its subscriber", async () => {
		renderScreen();
		fireEvent.click(
			await screen.findByRole("button", { name: t("action.retryLabel", { subscriber: "search-index" }) }),
		);

		await waitFor(() => expect(posts()).toEqual([["/v1/events/e1/retry", { subscriber: "search-index" }]]));
	});

	it("EVENT-R1 asks before dismissing, then posts", async () => {
		renderScreen();
		fireEvent.click(await screen.findByRole("button", { name: t("action.dismissLabel", { subscriber: "webhook" }) }));

		expect(posts()).toEqual([]);
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: t("action.dismiss") }));

		await waitFor(() => expect(posts()).toEqual([["/v1/events/e2/dismiss", { subscriber: "webhook" }]]));
	});

	it("EVENT-R1 retries everything due", async () => {
		let retried = false;
		api.on("POST /v1/events/retry", () => {
			retried = true;
			return { delivered: 1, failed: 0, dead: 0, counts };
		});
		listing(() =>
			retried
				? { items: [], total: 0, counts: { ...counts, failed: 0 } }
				: { items: [item("e1", "search-index", "failed")], total: 1, counts },
		);
		renderScreen();
		fireEvent.click(await screen.findByRole("button", { name: t("action.retryAll") }));

		await waitFor(() => expect(posts()).toEqual([["/v1/events/retry", {}]]));
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(await screen.findByText(t("list.emptyYet"))).toBeInTheDocument();
		// Nothing pending or failed is left to retry.
		expect(screen.queryByRole("button", { name: t("action.retryAll") })).toBeNull();
	});

	it("EVENT-L1 opens on all recent events, not only the failed ones", async () => {
		listing(() => ({
			items: [item("e3", "search-index", "delivered", "saved"), item("e1", "webhook", "failed")],
			total: 2,
			counts,
		}));
		renderScreen();

		const deliveredRow = await rowWith("slug-e3");
		expect(within(deliveredRow).getByText(t("state.delivered"))).toBeInTheDocument();
		expect(within(deliveredRow).getByText(t("kind.saved"))).toBeInTheDocument();
		// A delivered event has nothing to retry or dismiss; a failed one does.
		for (const action of deliveryActions("search-index")) {
			expect(within(deliveredRow).queryByRole("button", action)).toBeNull();
		}
		const failedRow = await rowWith("slug-e1");
		for (const action of deliveryActions("webhook"))
			expect(within(failedRow).getByRole("button", action)).toBeEnabled();
		const list = api.sent("GET /v1/events").find((request) => request.query.has("state"));
		expect(list?.query.getAll("state")).toEqual(expect.arrayContaining(["pending", "delivered", "failed", "dead"]));
	});

	it("EVENT-F2 filters by delivery status and returns to all from the empty state", async () => {
		// The sidebar's failed-delivery count is a request without a state; the list is the one that names states.
		const requested = () =>
			api
				.sent("GET /v1/events")
				.map((request) => request.query.getAll("state"))
				.filter((states) => states.length > 0);
		listing((query) => {
			const states = query.getAll("state");
			const onlyFailed = states.length === 2 && states.includes("failed");
			return {
				items: onlyFailed ? [] : [item("e3", "search-index", "delivered")],
				total: onlyFailed ? 0 : 1,
				counts,
			};
		});
		renderScreen();
		await screen.findByText("search-index");

		fireEvent.click(screen.getByRole("tab", { name: t("filter.failed") }));
		expect(await screen.findByText(t("list.emptyNoMatch"))).toBeInTheDocument();
		expect(requested().at(-1)?.sort()).toEqual(["dead", "failed"]);

		fireEvent.click(screen.getByRole("button", { name: t("list.clearFilters") }));
		expect(await screen.findByText("search-index")).toBeInTheDocument();
		expect(requested().at(-1)).toEqual(expect.arrayContaining(["pending", "delivered", "failed", "dead", "recorded"]));
	});
});
