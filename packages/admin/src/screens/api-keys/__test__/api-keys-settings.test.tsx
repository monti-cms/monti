import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { renderWithSite as render } from "../../__test__/site-wrapper";
import { AdminQueryProvider } from "../../shared/query-provider";
import { ApiKeysSettings } from "../api-keys-settings";
import { apiKeysMessages } from "../messages";

const t = testSite.createTranslator(apiKeysMessages);

vi.mock("sonner", () => ({ Toaster: () => null, toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const key = (
	id: string,
	name: string,
	tail: string,
	uses: Array<{ plugin: string; slot: string; label: string }> = [],
) => ({
	id,
	name,
	tail,
	readable: true,
	version: 1,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	uses,
});

let keys: ReturnType<typeof key>[];
let secretsAvailable: boolean;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	secretsAvailable = true;
	keys = [
		key("k1", "Anthropic", "91c0", [
			{ plugin: "ai", slot: "connection:a", label: "AI connection “Claude”" },
			{ plugin: "ai", slot: "connection:b", label: "AI connection “Translate”" },
		]),
		key("k2", "Spare", "77e1"),
	];
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const method = init?.method ?? "GET";
		if (method === "GET" && input === "/api/monti/v1/api-keys") return json({ items: keys, secretsAvailable });
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

describe("API keys tab", () => {
	it("lists each key with a masked tail and where it is used, and never a value", async () => {
		renderTab();
		const anthropic = await row("Anthropic");
		expect(anthropic.getByText(/••••91c0/)).toBeTruthy();
		expect(anthropic.getByText(/AI connection “Claude”/)).toBeTruthy();
		expect((await row("Spare")).getByText(t("row.unused"))).toBeTruthy();
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
		expect(await screen.findByText(t("secret.title"))).toBeTruthy();
		expect((screen.getAllByRole("button", { name: t("add") })[0] as HTMLButtonElement).disabled).toBe(true);
	});

	it("adds a key from the dialog", async () => {
		renderTab();
		await screen.findByTestId("api-key-Spare");
		fireEvent.click(screen.getAllByRole("button", { name: t("add") })[0] as HTMLElement);
		const dialog = within(await screen.findByTestId("api-key-dialog"));
		fireEvent.change(dialog.getByLabelText(t("field.name")), { target: { value: "Bareun" } });
		fireEvent.change(dialog.getByLabelText(t("field.value")), { target: { value: "brn-secret-value-1" } });
		fireEvent.click(dialog.getByRole("button", { name: t("dialog.add.confirm") }));
		await waitFor(() =>
			expect(
				fetchMock.mock.calls.some(
					([url, init]) =>
						url === "/api/monti/v1/api-keys" &&
						(init as RequestInit).method === "POST" &&
						JSON.parse(String((init as RequestInit).body)).name === "Bareun",
				),
			).toBe(true),
		);
	});
});
