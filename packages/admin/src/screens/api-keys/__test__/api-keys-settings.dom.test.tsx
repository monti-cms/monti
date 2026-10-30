import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { jsonResponse as json } from "../../../test/fetch";
import { renderWithSite as render } from "../../../test/site";
import { AdminQueryProvider } from "../../shared/query-provider";
import { ApiKeysSettings } from "../api-keys-settings";
import { apiKeysMessages } from "../messages";

const t = testSite.createTranslator(apiKeysMessages);

vi.mock("../../../router", () => ({
	AdminLink: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const key = (
	id: string,
	name: string,
	tail: string,
	uses: Array<{ plugin: string; ref: string; label: string }> = [],
) => ({
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

let keys: ReturnType<typeof key>[];
let secretsAvailable: boolean;
let slots: Array<{ plugin: string; slot: string; label: string; service: string; key: unknown }>;
let fetchMock: ReturnType<typeof vi.fn>;

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
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const method = init?.method ?? "GET";
		if (method === "GET" && input === "/api/monti/v1/api-keys") return json({ items: keys, secretsAvailable, slots });
		if (method === "PUT" && input === "/api/monti/v1/api-keys/slots")
			return json({ items: keys, secretsAvailable, slots });
		if (method === "DELETE" || method === "POST" || method === "PATCH") return json({ ok: true });
		throw new Error(`Unexpected fetch ${method} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
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

const row = async (name: string) => within(await screen.findByTestId(`api-key-${name}`));
const deleteCalls = () =>
	fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "DELETE");

describe("API keys page", () => {
	it("lists each key with a masked tail and where it is used, and never a value", async () => {
		renderTab();
		const anthropic = await row("Anthropic");
		expect(anthropic.getByText(/••••91c0/)).toBeInTheDocument();
		expect(anthropic.getByText(/AI connection “Claude”/)).toBeInTheDocument();
		expect((await row("Spare")).getByText(t("row.unused"))).toBeInTheDocument();
	});

	it("asks before deleting a key that is in use, lists what stops working, and deletes with force only after confirming", async () => {
		renderTab();
		const anthropic = await row("Anthropic");
		fireEvent.click(anthropic.getByRole("button", { name: t("row.menu", { name: "Anthropic" }) }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("menu.delete") }));

		const dependents = await screen.findByTestId("delete-dependents");
		expect(
			within(dependents)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["AI connection “Claude”", "AI connection “Translate”"]);
		expect(deleteCalls()).toHaveLength(0);

		fireEvent.click(screen.getByRole("button", { name: t("delete.confirm") }));
		await waitFor(() => expect(deleteCalls()).toHaveLength(1));
		expect(String(deleteCalls()[0]?.[0])).toContain("force=true");
	});

	it("deletes an unused key without force", async () => {
		renderTab();
		const spare = await row("Spare");
		fireEvent.click(spare.getByRole("button", { name: t("row.menu", { name: "Spare" }) }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("menu.delete") }));
		fireEvent.click(await screen.findByRole("button", { name: t("delete.confirm") }));
		await waitFor(() => expect(deleteCalls()).toHaveLength(1));
		expect(String(deleteCalls()[0]?.[0])).not.toContain("force");
	});

	it("cannot add a key while the server has no secret, and says why", async () => {
		secretsAvailable = false;
		renderTab();
		expect(await screen.findByText(t("secret.description"))).toBeInTheDocument();
		expect((screen.getAllByRole("button", { name: t("add") })[0] as HTMLButtonElement).disabled).toBe(true);
	});

	it("adds a key from the dialog", async () => {
		renderTab();
		await screen.findByTestId("api-key-Spare");
		fireEvent.click(screen.getAllByRole("button", { name: t("add") })[0] as HTMLElement);
		const dialog = within(await screen.findByTestId("api-key-dialog"));
		fireEvent.change(dialog.getByLabelText(t("field.name")), { target: { value: "Speller" } });
		fireEvent.change(dialog.getByLabelText(t("field.value")), { target: { value: "brn-secret-value-1" } });
		fireEvent.click(dialog.getByRole("button", { name: t("dialog.add.confirm") }));
		await waitFor(() =>
			expect(
				fetchMock.mock.calls.some(
					([url, init]) =>
						url === "/api/monti/v1/api-keys" &&
						(init as RequestInit).method === "POST" &&
						JSON.parse(String((init as RequestInit).body)).name === "Speller",
				),
			).toBe(true),
		);
	});

	it("lists a plugin's key slot that has no key as a row with an action to add one, and counts it as needed", async () => {
		renderTab();
		const slot = within(await screen.findByTestId("api-key-slot-speller-key"));
		expect(slot.getByText("Spell check")).toBeInTheDocument();
		expect(slot.getByText(t("slot.empty"))).toBeInTheDocument();
		expect(await screen.findByText(new RegExp(t("count.needed", { count: 1 })))).toBeInTheDocument();
	});

	const putCalls = () =>
		fetchMock.mock.calls
			.filter(([url, init]) => url === "/api/monti/v1/api-keys/slots" && (init as RequestInit).method === "PUT")
			.map(([, init]) => JSON.parse(String((init as RequestInit).body)));

	it("assigns a saved key to the slot", async () => {
		renderTab();
		const slot = within(await screen.findByTestId("api-key-slot-speller-key"));
		fireEvent.click(slot.getByRole("button", { name: t("slot.assign") }));
		const dialog = within(await screen.findByTestId("api-key-slot-dialog"));
		fireEvent.click(dialog.getByRole("button", { name: t("slot.dialog.confirm") }));
		await waitFor(() =>
			expect(putCalls()).toEqual([{ plugin: "speller", slot: "key", key: { use: "saved", keyId: "k1" } }]),
		);
	});

	it("enters a new key for the slot, sent in the same request as the assignment", async () => {
		renderTab();
		const slot = within(await screen.findByTestId("api-key-slot-speller-key"));
		fireEvent.click(slot.getByRole("button", { name: t("slot.assign") }));
		const dialog = within(await screen.findByTestId("api-key-slot-dialog"));
		fireEvent.click(dialog.getByRole("radio", { name: t("field.useNew") }));
		fireEvent.change(dialog.getByLabelText(t("field.newInput")), { target: { value: "brn-secret-value-1" } });
		fireEvent.click(dialog.getByRole("button", { name: t("slot.dialog.confirm") }));
		await waitFor(() =>
			expect(putCalls()).toEqual([
				{ plugin: "speller", slot: "key", key: { use: "new", value: "brn-secret-value-1" } },
			]),
		);
		expect(
			fetchMock.mock.calls.some(
				([url, init]) => url === "/api/monti/v1/api-keys" && (init as RequestInit).method === "POST",
			),
		).toBe(false);
	});

	it("clears an assigned slot from the key's row menu", async () => {
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
		expect(screen.queryByTestId("api-key-slot-speller-key")).toBeNull();
		fireEvent.click(speller.getByRole("button", { name: t("row.menu", { name: "Speller" }) }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("menu.clearSlot", { label: "Spell check" }) }));
		await waitFor(() => expect(putCalls()).toEqual([{ plugin: "speller", slot: "key", key: { use: "none" } }]));
	});
});
