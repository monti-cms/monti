import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { ApiKeysSettings } from "../../../admin/src/screens/api-keys/api-keys-settings";
import { KeySectionsProvider } from "../../../admin/src/screens/api-keys/key-sections";
import { type FakeApi, PageFrame } from "../../../admin/src/stories/screen-frame";
import type { AiSettingsView } from "../connection";
import { ModelSection } from "./model-section";

/** Tools › API keys with the AI plugin: its 모델 section, the quick-task model, after the saved keys (flow 10 · 기본, 13, 13b). */
const meta = {
	title: "Screens/API keys/With the AI plugin",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const key = (id: string, name: string, service: string, tail: string, usage: number) => ({
	id,
	name,
	service,
	url: "",
	tail,
	readable: true,
	usage,
	version: 1,
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-10-01T00:00:00.000Z",
	uses: [],
});

const KEYS = {
	items: [
		key("a", "Anthropic 개인", "anthropic", "a1b2", 1_240_000),
		key("o", "OpenAI 회사", "openai", "77de", 312_000),
		key("g", "예전 Gemini 키", "google", "9f0c", 0),
	],
	secretsAvailable: true,
	services: [],
	slots: [
		{ plugin: "bareun", slot: "key", label: "맞춤법 검사 키", service: "bareun", key: null },
		{ plugin: "algolia", slot: "search", label: "검색 키", service: "algolia", key: null },
		{ plugin: "algolia", slot: "admin", label: "관리 키", service: "algolia", key: null },
	],
};

const SETTINGS: AiSettingsView = {
	version: 1,
	keys: [
		{ id: "a", name: "Anthropic 개인", service: "anthropic", ready: true },
		{ id: "o", name: "OpenAI 회사", service: "openai", ready: true },
		{ id: "g", name: "예전 Gemini 키", service: "google", ready: true },
	],
	quick: { keyId: "a", model: "claude-haiku-5-5", keyName: "Anthropic 개인" },
	assistant: { keyId: "a", model: "claude-sonnet-5-5", keyName: "Anthropic 개인" },
	toolSupport: {},
	fake: false,
	unopenedDays: 30,
};

const MODELS: Record<string, string[]> = {
	a: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
	o: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4.1"],
	g: ["gemini-2.5-pro", "gemini-2.5-flash"],
};

const api = (): FakeApi => {
	let settings = SETTINGS;
	return (path, method, body) => {
		if (path === "/api/monti/v1/api-keys") return KEYS;
		if (path === "/api/monti/v1/ai/settings") {
			if (method === "PUT") {
				const { quick } = body as { quick: { keyId: string; model: string } };
				const keyName = settings.keys.find((entry) => entry.id === quick.keyId)?.name ?? "";
				settings = { ...settings, version: settings.version + 1, quick: { ...quick, keyName } };
			}
			return settings;
		}
		if (path === "/api/monti/v1/ai/models") {
			return { items: (MODELS[(body as { keyId: string }).keyId] ?? []).map((id) => ({ id })) };
		}
		return undefined;
	};
};

const screen = () => (
	<PageFrame api={api()} pathname="/admin/tools/api-keys">
		<KeySectionsProvider sections={{ models: ModelSection }}>
			<ApiKeysSettings />
		</KeySectionsProvider>
	</PageFrame>
);

/** 기본: the saved keys, the quick-task model, the plugins. */
export const Loaded: Story = { tags: ["visual"], render: screen };

/** 13: the quick-task model's menu, grouped by key. */
export const QuickModelMenu: Story = {
	render: screen,
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /빠른 작업/ }));
		await within(document.body).findByText("gpt-5-mini");
	},
};

/** 13b: a pick applies at once, with a toast. */
export const QuickModelChanged: Story = {
	render: screen,
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /빠른 작업/ }));
		await userEvent.click(await within(document.body).findByRole("menuitemradio", { name: /gpt-5-mini/ }));
		// The quick model's row names its service now, as the assistant's row already did.
		await within(canvasElement).findAllByText("OpenAI 회사");
	},
};
