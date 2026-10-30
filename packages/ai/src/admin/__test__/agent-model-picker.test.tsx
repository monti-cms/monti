// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseSelectOption } from "../../../../admin/src/test/base-ui";
import { jsonResponse as json } from "../../../../admin/src/test/fetch";
import { renderWithSite } from "../../../../admin/src/test/site";
import { testSite } from "../../../test/site";
import type { AiProviderView, AiSettingsView } from "../../connection";
import { AgentModelPicker } from "../agent-model-picker";
import { agentPanelMessages } from "../agent-panel.messages";

const t = testSite.createTranslator(agentPanelMessages);

const provider = (id: string, overrides: Partial<AiProviderView> = {}): AiProviderView => ({
	id,
	name: `Connection ${id}`,
	kind: "chat",
	url: "https://example.test/v1",
	key: null,
	defaultModel: "default-model",
	ready: true,
	toolSupport: {},
	...overrides,
});
const view = (overrides: Partial<AiSettingsView> = {}): AiSettingsView => ({
	version: 3,
	providers: [provider("a", { toolSupport: { "default-model": true, "weak-model": false } }), provider("b")],
	fake: false,
	agent: {
		setting: null,
		effective: { providerId: "a", providerName: "Connection a", model: "default-model", tools: true },
	},
	...overrides,
});

let fetchMock: ReturnType<typeof vi.fn>;
const onSaved = vi.fn();
const onConflict = vi.fn();
const puts = () =>
	fetchMock.mock.calls
		.filter(([, init]) => init?.method === "PUT")
		.map(([input, init]) => [String(input), JSON.parse(String((init as RequestInit).body))]);

beforeEach(() => {
	vi.clearAllMocks();
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		if (String(input).endsWith("/v1/ai/models"))
			return json({ items: [{ id: "default-model" }, { id: "other-model" }] });
		if (String(input).endsWith("/v1/ai/settings") && init?.method === "PUT") return json(view());
		throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderPicker = (settings: AiSettingsView = view()) =>
	renderWithSite(<AgentModelPicker settings={settings} onSaved={onSaved} onConflict={onConflict} />);
const connectionSelect = () => screen.getByRole("combobox", { name: t("picker.connection") });

describe("assistant model picker", () => {
	it("is not shown when there is no chat connection to pick", () => {
		renderPicker(view({ providers: [provider("d", { kind: "decisions" })] }));
		expect(screen.queryByText(t("picker.title"))).toBeNull();
	});

	it("starts on the default, with nothing to save", () => {
		renderPicker();
		expect(connectionSelect()).toHaveTextContent(t("picker.default"));
		expect(screen.getByRole("button", { name: t("picker.save") })).toBeDisabled();
		expect(screen.queryByRole("button", { name: t("picker.reset") })).toBeNull();
	});

	it("shows what the connection check found about the model's tool calling", async () => {
		renderPicker(view({ agent: { setting: { providerId: "a", model: "default-model" }, effective: null } }));
		expect(screen.getByText(t("picker.tools.yes"))).toBeInTheDocument();
		cleanup();
		renderPicker(view({ agent: { setting: { providerId: "a", model: "weak-model" }, effective: null } }));
		expect(screen.getByText(t("picker.tools.no"))).toBeInTheDocument();
		cleanup();
		renderPicker(view({ agent: { setting: { providerId: "b", model: "default-model" }, effective: null } }));
		expect(screen.getByText(t("picker.tools.unknown"))).toBeInTheDocument();
	});

	it("saves the chosen connection and its default model with the version it read", async () => {
		renderPicker();
		await chooseSelectOption(t("picker.connection"), "Connection b");
		fireEvent.click(screen.getByRole("button", { name: t("picker.save") }));

		await waitFor(() => expect(puts()).toHaveLength(1));
		expect(puts()[0]).toEqual([
			"/api/monti/v1/ai/settings",
			{ expectedVersion: 3, agent: { providerId: "b", model: "default-model" } },
		]);
		await waitFor(() => expect(onSaved).toHaveBeenCalled());
	});

	it("goes back to the default with `agent: null`", async () => {
		renderPicker(view({ agent: { setting: { providerId: "a", model: "weak-model" }, effective: null } }));
		fireEvent.click(screen.getByRole("button", { name: t("picker.reset") }));
		fireEvent.click(screen.getByRole("button", { name: t("picker.save") }));
		await waitFor(() => expect(puts()).toHaveLength(1));
		expect(puts()[0]?.[1]).toEqual({ expectedVersion: 3, agent: null });
	});

	it("asks the screen to read the settings again when the save is refused as stale", async () => {
		fetchMock.mockImplementation(async (_input: string, init?: RequestInit) =>
			init?.method === "PUT"
				? json({ error: { code: "conflict", message: "Changed elsewhere" } }, 409)
				: json({ items: [] }),
		);
		renderPicker();
		await chooseSelectOption(t("picker.connection"), "Connection b");
		fireEvent.click(screen.getByRole("button", { name: t("picker.save") }));
		await waitFor(() => expect(onConflict).toHaveBeenCalled());
		expect(onSaved).not.toHaveBeenCalled();
	});
});
