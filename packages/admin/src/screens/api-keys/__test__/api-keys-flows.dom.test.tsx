import type { ApiKeyServiceView, ApiKeySlotView, ApiKeyView } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { type FakeApi, failure, fakeApi } from "../../../test/fake-api";
import { renderInRouter as render } from "../../../test/router";
import { AdminQueryProvider } from "../../shared/query-provider";
import { ApiKeysSettings } from "../api-keys-settings";
import { apiKeysMessages } from "../messages";

const t = testSite.createTranslator(apiKeysMessages);

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const SERVICES: ApiKeyServiceView[] = [
	{ id: "anthropic", label: "Anthropic", group: "ai", keyPlaceholder: "sk-ant-…" },
	{
		id: "openai-compatible",
		label: "OpenAI-compatible address",
		group: "ai",
		url: { placeholder: "http://localhost:11434/v1" },
		keyOptional: true,
	},
	{ id: "speller", label: "Speller", group: "plugin", hint: "speller" },
];

const key = (id: string, name: string, service: string, tail: string, extra: Partial<ApiKeyView> = {}): ApiKeyView => ({
	id,
	name,
	service,
	url: "",
	tail,
	readable: true,
	usage: 0,
	version: 1,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	uses: [],
	...extra,
});

let keys: ApiKeyView[];
let secretsAvailable: boolean;
let slots: ApiKeySlotView[];
let rejectNext: boolean;
let api: FakeApi;

beforeEach(() => {
	secretsAvailable = true;
	rejectNext = false;
	slots = [{ plugin: "speller", slot: "key", label: "Spell check", service: "speller", key: null }];
	keys = [
		key("k1", "Anthropic", "anthropic", "91c0", {
			usage: 1_240_000,
			uses: [{ plugin: "ai", ref: "quick:claude-haiku-5-5", label: "Quick tasks", value: "claude-haiku-5-5" }],
		}),
		key("k2", "Spare", "anthropic", "77e1"),
	];
	api = fakeApi()
		// The rail's counts: the trash and the failed deliveries.
		.on("GET /v1/trash", () => ({ items: [], total: 0, kinds: {} }))
		.on("GET /v1/events", () => ({
			items: [],
			total: 0,
			counts: { pending: 0, delivering: 0, delivered: 0, failed: 0, dead: 0, dismissed: 0 },
		}))
		.on("GET /v1/api-keys", () => ({ items: keys, secretsAvailable, services: SERVICES, slots }))
		.on("PUT /v1/api-keys/slots", () => ({ items: keys, secretsAvailable, services: SERVICES, slots }))
		.on("POST /v1/api-keys", ({ body }) => {
			if (rejectNext) return failure("key_rejected", "rejected");
			const added = key("k9", body.name, body.service, body.value?.slice(-4) ?? "");
			keys = [...keys, added];
			return added;
		})
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

const keyField = (dialog: ReturnType<typeof within>) => dialog.getByLabelText(new RegExp(`^${t("field.key")}\\*?$`));
const nameField = (dialog: ReturnType<typeof within>) =>
	dialog.getByLabelText(new RegExp(`^${t("field.name")}\\*?$`)) as HTMLInputElement;

/** Opens "+ Add key" and picks a service. */
const startAdd = async (service: string) => {
	// The button turns on once the keys are read.
	await screen.findByText(t("section.keys"));
	fireEvent.click(screen.getByRole("button", { name: new RegExp(t("add")) }));
	fireEvent.click(
		await within(await screen.findByRole("dialog")).findByRole("option", { name: new RegExp(`^${service}`) }),
	);
	return within(await screen.findByRole("dialog"));
};

describe("Flow 10 · API keys", () => {
	it("KEY-W1 picks the service first, prefills the name with it, and sends service, name and key (10·1–2, 6)", async () => {
		keys = [];
		renderTab();
		await screen.findByText(t("row.none"));
		const dialog = await startAdd("Anthropic");
		expect(nameField(dialog).value).toBe("Anthropic");
		fireEvent.change(keyField(dialog), { target: { value: "sk-ant-api03-0000003f9e" } });
		fireEvent.click(dialog.getByRole("button", { name: t("dialog.addConfirm") }));
		await waitFor(() =>
			expect(api.sent("POST /v1/api-keys").map((request) => request.body)).toEqual([
				{ service: "anthropic", name: "Anthropic", value: "sk-ant-api03-0000003f9e" },
			]),
		);
		expect(await screen.findByText("Anthropic")).toBeInTheDocument();
	});

	it("KEY-N1 prefills a free name when the service's name is taken, and says so (10·5)", async () => {
		keys = [key("k1", "anthropic", "anthropic", "91c0")];
		renderTab();
		await screen.findByText("anthropic");
		const dialog = await startAdd("Anthropic");
		expect(nameField(dialog).value).toBe("Anthropic 2");
		expect(dialog.getByText(t("field.nameTaken", { name: "Anthropic" }))).toBeInTheDocument();
	});

	it("KEY-C2 asks an OpenAI-compatible server's address, names the key after its host, and lets the key be empty (10·2b)", async () => {
		renderTab();
		const dialog = await startAdd("OpenAI-compatible address");
		fireEvent.change(dialog.getByLabelText(new RegExp(`^${t("field.url")}`)), {
			target: { value: "http://localhost:11434/v1" },
		});
		expect(nameField(dialog).value).toBe("localhost:11434");
		fireEvent.click(dialog.getByRole("button", { name: t("dialog.addConfirm") }));
		await waitFor(() =>
			expect(api.sent("POST /v1/api-keys").map((request) => request.body)).toEqual([
				{ service: "openai-compatible", name: "localhost:11434", url: "http://localhost:11434/v1" },
			]),
		);
	});

	it("KEY-C1 keeps the dialog open with one line under the key when the service refuses it (10·4)", async () => {
		rejectNext = true;
		renderTab();
		const dialog = await startAdd("Anthropic");
		fireEvent.change(keyField(dialog), { target: { value: "sk-ant-wrong-0000000000" } });
		fireEvent.click(dialog.getByRole("button", { name: t("dialog.addConfirm") }));
		expect(await dialog.findByText(t("field.rejected"))).toBeInTheDocument();
		expect(keyField(dialog).getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByRole("dialog")).toBeInTheDocument();
	});

	it("KEY-W4 edits a key: the key stays unless 바꾸기 is used and a new one typed (10·7–10)", async () => {
		renderTab();
		fireEvent.click(await screen.findByRole("button", { name: `${t("row.edit")} Spare` }));
		let dialog = within(await screen.findByRole("dialog"));
		expect(dialog.getByText(t("row.tail", { tail: "77e1" }))).toBeInTheDocument();
		fireEvent.change(nameField(dialog), { target: { value: "Backup" } });
		fireEvent.click(dialog.getByRole("button", { name: t("dialog.saveConfirm") }));
		await waitFor(() => expect(api.sent("PATCH /v1/api-keys/:id")).toHaveLength(1));
		expect(api.sent("PATCH /v1/api-keys/:id")[0]?.body).toEqual({ expectedVersion: 1, name: "Backup" });

		fireEvent.click(await screen.findByRole("button", { name: `${t("row.edit")} Spare` }));
		dialog = within(await screen.findByRole("dialog"));
		fireEvent.click(dialog.getByRole("button", { name: t("key.replace") }));
		fireEvent.change(keyField(dialog), { target: { value: "sk-ant-api03-000000007c0e" } });
		fireEvent.click(dialog.getByRole("button", { name: t("dialog.saveConfirm") }));
		await waitFor(() => expect(api.sent("PATCH /v1/api-keys/:id")).toHaveLength(2));
		expect(api.sent("PATCH /v1/api-keys/:id")[1]?.body).toEqual({
			expectedVersion: 1,
			value: "sk-ant-api03-000000007c0e",
		});
	});

	it("KEY-W4 asks for a key that cannot be read again, with the key field open (10·14, 14b)", async () => {
		keys = [key("k1", "Anthropic", "anthropic", "91c0", { readable: false })];
		renderTab();
		expect(await screen.findByText(t("banner.unreadable", { count: 1 }))).toBeInTheDocument();
		fireEvent.click(await screen.findByRole("button", { name: `${t("row.edit")} Anthropic` }));
		const dialog = within(await screen.findByRole("dialog"));
		expect(dialog.queryByRole("button", { name: t("key.replace") })).toBeNull();
		expect(dialog.getByText(t("field.again"))).toBeInTheDocument();
		expect((keyField(dialog) as HTMLInputElement).required).toBe(true);
	});

	it("KEY-W2 always asks before deleting; a key in use lists what stops and is deleted with force (10·11)", async () => {
		renderTab();
		fireEvent.click(await screen.findByRole("button", { name: `${t("row.delete")} Anthropic` }));
		const dialog = within(await screen.findByRole("alertdialog", { name: t("delete.title", { name: "Anthropic" }) }));
		expect(dialog.getByText("Quick tasks")).toBeInTheDocument();
		expect(dialog.getByText("claude-haiku-5-5")).toBeInTheDocument();
		expect(api.sent("DELETE /v1/api-keys/:id")).toHaveLength(0);
		fireEvent.click(dialog.getByRole("button", { name: t("delete.confirm") }));
		await waitFor(() => expect(api.sent("DELETE /v1/api-keys/:id")).toHaveLength(1));
		expect(api.sent("DELETE /v1/api-keys/:id")[0]?.query.get("force")).toBe("true");
	});

	it("KEY-W2 asks before deleting a key nothing uses too, and deletes it without force (10·11b)", async () => {
		renderTab();
		fireEvent.click(await screen.findByRole("button", { name: `${t("row.delete")} Spare` }));
		const dialog = within(await screen.findByRole("alertdialog"));
		expect(dialog.getByText(t("delete.unused"))).toBeInTheDocument();
		fireEvent.click(dialog.getByRole("button", { name: t("delete.confirm") }));
		await waitFor(() => expect(api.sent("DELETE /v1/api-keys/:id")).toHaveLength(1));
		expect(api.sent("DELETE /v1/api-keys/:id")[0]?.query.has("force")).toBe(false);
	});

	it("KEY-W3 counts a plugin's slot with no key as needed, and its 키 없음 opens 키 추가 with the service picked (10·12)", async () => {
		renderTab();
		const plugins = await screen.findByRole("region", { name: new RegExp(t("section.plugins")) });
		expect(within(plugins).getByText("1")).toBeInTheDocument();
		fireEvent.click(within(plugins).getByRole("button", { name: "Speller" }));
		const dialog = within(await screen.findByRole("dialog"));
		expect(dialog.queryByRole("combobox")).toBeNull();
		fireEvent.change(keyField(dialog), { target: { value: "brn-live-0000000004410" } });
		fireEvent.click(dialog.getByRole("button", { name: t("dialog.addConfirm") }));
		await waitFor(() =>
			expect(api.sent("POST /v1/api-keys").map((request) => request.body)).toEqual([
				{ service: "speller", name: "Speller", value: "brn-live-0000000004410" },
			]),
		);
	});

	it("KEY-W3 picks which key of its service a slot reads (10·12b)", async () => {
		keys = [...keys, key("s1", "Speller", "speller", "4410"), key("s2", "Speller 2", "speller", "5521")];
		slots = [
			{
				plugin: "speller",
				slot: "key",
				label: "Spell check",
				service: "speller",
				key: { id: "s1", name: "Speller", tail: "4410", readable: true },
			},
		];
		renderTab();
		const plugins = await screen.findByRole("region", { name: new RegExp(t("section.plugins")) });
		fireEvent.click(within(plugins).getByRole("button", { name: "Speller" }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: /Speller 2/ }));
		await waitFor(() =>
			expect(api.sent("PUT /v1/api-keys/slots").map((request) => request.body)).toEqual([
				{ plugin: "speller", slot: "key", keyId: "s2" },
			]),
		);
	});

	it("KEY-A3 cannot add a key while the server has no secret, and says why (10·15)", async () => {
		secretsAvailable = false;
		renderTab();
		expect(await screen.findByText(t("banner.noSecret"))).toBeInTheDocument();
		expect((screen.getByRole("button", { name: new RegExp(t("add")) }) as HTMLButtonElement).disabled).toBe(true);
	});
});
