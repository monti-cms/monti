import type { ApiKeySlotView, ApiKeyView } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { type FakeApi, fakeApi } from "../../../test/fake-api";
import { renderInRouter as render } from "../../../test/router";
import { AdminQueryProvider } from "../../shared/query-provider";
import { ApiKeysSettings } from "../api-keys-settings";
import { apiKeysMessages } from "../messages";

const t = testSite.createTranslator(apiKeysMessages);

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const key = (
	id: string,
	name: string,
	tail: string,
	uses: Array<{ plugin: string; ref: string; label: string }> = [],
): ApiKeyView => ({
	id,
	name,
	tail,
	readable: true,
	version: 1,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	uses,
	slots: uses.filter((use) => use.plugin === "speller"),
});

let keys: ApiKeyView[];
let secretsAvailable: boolean;
let slots: ApiKeySlotView[];
let api: FakeApi;

beforeEach(() => {
	secretsAvailable = true;
	slots = [{ plugin: "speller", slot: "key", label: "Spell check", service: "Speller", key: null }];
	keys = [
		key("k1", "Anthropic", "91c0", [
			{ plugin: "ai", ref: "connection:a", label: "AI connection “Claude”" },
			{ plugin: "ai", ref: "connection:b", label: "AI connection “Translate”" },
		]),
		key("k2", "Spare", "77e1"),
	];
	// The server answers a write with the key it wrote (POST, PATCH), the whole list (PUT of a slot) or nothing (DELETE, 204).
	api = fakeApi()
		// The rail's counts: the trash and the failed deliveries.
		.on("GET /v1/trash", () => ({ items: [], total: 0, kinds: {} }))
		.on("GET /v1/events", () => ({
			items: [],
			total: 0,
			counts: { pending: 0, delivering: 0, delivered: 0, failed: 0, dead: 0, dismissed: 0 },
		}))
		.on("GET /v1/api-keys", () => ({ items: keys, secretsAvailable, slots }))
		.on("PUT /v1/api-keys/slots", () => ({ items: keys, secretsAvailable, slots }))
		.on("POST /v1/api-keys", ({ body }): ApiKeyView => key("k9", body.name, body.value.slice(-4)))
		.on("PATCH /v1/api-keys/:id", ({ params }) => keys.find((item) => item.id === params.id))
		.on("DELETE /v1/api-keys/:id", () => undefined)
		.install();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderTab = () =>
	render(
		<AdminQueryProvider>
			<ApiKeysSettings />
		</AdminQueryProvider>,
	);

/** The page's list of keys and of the plugin slots still waiting for one. */
const keyList = () => screen.findByRole("list", { name: t("title") });
/** The row of a key, the one item of the list with that key's menu. */
const row = async (name: string) => {
	const items = within(await keyList()).getAllByRole("listitem");
	const found = items.find((item) => within(item).queryByRole("button", { name: t("row.menu", { name }) }));
	if (!found) throw new Error(`no row for the key ${name}`);
	return within(found);
};
/** The row of a plugin's slot that has no key: the item that offers to assign one. */
const slotRow = async (label: string) => {
	const items = within(await keyList()).getAllByRole("listitem");
	const found = items.find(
		(item) => within(item).queryByText(label) && within(item).queryByRole("button", { name: t("slot.assign") }),
	);
	if (!found) throw new Error(`no row for the slot ${label}`);
	return within(found);
};
const deleteCalls = () => api.sent("DELETE /v1/api-keys/:id");

describe("API keys page", () => {
	it("KEY-A1 lists each key with a masked tail and where it is used, and never a value", async () => {
		renderTab();
		const anthropic = await row("Anthropic");
		expect(anthropic.getByText(/••••91c0/)).toBeInTheDocument();
		expect(anthropic.getByText(/AI connection “Claude”/)).toBeInTheDocument();
		expect((await row("Spare")).getByText(t("row.unused"))).toBeInTheDocument();
	});

	it("KEY-W2 asks before deleting a key that is in use, lists what stops working, and deletes with force only after confirming", async () => {
		renderTab();
		const anthropic = await row("Anthropic");
		fireEvent.click(anthropic.getByRole("button", { name: t("row.menu", { name: "Anthropic" }) }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("menu.delete") }));

		const dialog = await screen.findByRole("alertdialog", { name: t("delete.title", { name: "Anthropic" }) });
		expect(
			within(within(dialog).getByRole("list"))
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["AI connection “Claude”", "AI connection “Translate”"]);
		expect(deleteCalls()).toHaveLength(0);

		fireEvent.click(screen.getByRole("button", { name: t("delete.confirm") }));
		await waitFor(() => expect(deleteCalls()).toHaveLength(1));
		expect(deleteCalls()[0]?.query.get("force")).toBe("true");
	});

	it("KEY-W2 deletes an unused key without force", async () => {
		renderTab();
		const spare = await row("Spare");
		fireEvent.click(spare.getByRole("button", { name: t("row.menu", { name: "Spare" }) }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("menu.delete") }));
		fireEvent.click(await screen.findByRole("button", { name: t("delete.confirm") }));
		await waitFor(() => expect(deleteCalls()).toHaveLength(1));
		expect(deleteCalls()[0]?.query.has("force")).toBe(false);
	});

	it("KEY-A3 cannot add a key while the server has no secret, and says why", async () => {
		secretsAvailable = false;
		renderTab();
		expect(await screen.findByText(t("secret.description"))).toBeInTheDocument();
		expect((screen.getByRole("button", { name: t("add") }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("KEY-W1 adds a key from the dialog", async () => {
		renderTab();
		await row("Spare");
		fireEvent.click(screen.getByRole("button", { name: t("add") }));
		const dialog = within(await screen.findByRole("dialog"));
		fireEvent.change(dialog.getByLabelText(t("field.name")), { target: { value: "Speller" } });
		fireEvent.change(dialog.getByLabelText(t("field.value")), { target: { value: "brn-secret-value-1" } });
		fireEvent.click(dialog.getByRole("button", { name: t("dialog.add.confirm") }));
		await waitFor(() =>
			expect(api.sent("POST /v1/api-keys").some((request) => request.body.name === "Speller")).toBe(true),
		);
	});

	it("KEY-W3 lists a plugin's key slot that has no key as a row with an action to add one, and counts it as needed", async () => {
		renderTab();
		const slot = await slotRow("Spell check");
		expect(slot.getByText("Spell check")).toBeInTheDocument();
		expect(slot.getByText(t("slot.empty"))).toBeInTheDocument();
		expect(await screen.findByText(new RegExp(t("count.needed", { count: 1 })))).toBeInTheDocument();
	});

	const putCalls = () => api.sent("PUT /v1/api-keys/slots").map((request) => request.body);

	it("KEY-W3 assigns a saved key to the slot", async () => {
		renderTab();
		const slot = await slotRow("Spell check");
		fireEvent.click(slot.getByRole("button", { name: t("slot.assign") }));
		const dialog = within(await screen.findByRole("dialog"));
		fireEvent.click(dialog.getByRole("button", { name: t("slot.dialog.confirm") }));
		await waitFor(() =>
			expect(putCalls()).toEqual([{ plugin: "speller", slot: "key", key: { use: "saved", keyId: "k1" } }]),
		);
	});

	it("KEY-W3 enters a new key for the slot, sent in the same request as the assignment", async () => {
		renderTab();
		const slot = await slotRow("Spell check");
		fireEvent.click(slot.getByRole("button", { name: t("slot.assign") }));
		const dialog = within(await screen.findByRole("dialog"));
		fireEvent.click(dialog.getByRole("radio", { name: t("field.useNew") }));
		fireEvent.change(dialog.getByLabelText(t("field.newInput")), { target: { value: "brn-secret-value-1" } });
		fireEvent.click(dialog.getByRole("button", { name: t("slot.dialog.confirm") }));
		await waitFor(() =>
			expect(putCalls()).toEqual([
				{ plugin: "speller", slot: "key", key: { use: "new", value: "brn-secret-value-1" } },
			]),
		);
		expect(api.sent("POST /v1/api-keys")).toHaveLength(0);
	});

	it("KEY-W3 clears an assigned slot from the key's row menu", async () => {
		keys = [key("k3", "Speller", "77e1", [{ plugin: "speller", ref: "key", label: "Spell check" }])];
		slots = [
			{
				plugin: "speller",
				slot: "key",
				label: "Spell check",
				service: "Speller",
				key: { id: "k3", name: "Speller", tail: "77e1", readable: true },
			},
		];
		renderTab();
		const speller = await row("Speller");
		expect(speller.getByText(/Spell check/)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: t("slot.assign") })).toBeNull();
		fireEvent.click(speller.getByRole("button", { name: t("row.menu", { name: "Speller" }) }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("menu.clearSlot", { label: "Spell check" }) }));
		await waitFor(() => expect(putCalls()).toEqual([{ plugin: "speller", slot: "key", key: { use: "none" } }]));
	});
});
