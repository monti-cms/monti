import type { ApiKeyList, ApiKeyServiceView, ApiKeySlotView, ApiKeyUse, ApiKeyView } from "@monti-cms/core/site";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { answer, type FakeApi, PageFrame } from "../../stories/screen-frame";
import { ApiKeysSettings } from "./api-keys-settings";

/** Tools › API keys, one story per step of flow 10 (canvas page "흐름 10 · API 키"). The 모델 section is the AI plugin's (its own stories). */
const meta = { title: "Screens/API keys/API keys", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const SERVICES: ApiKeyServiceView[] = [
	{ id: "anthropic", label: "Anthropic", group: "ai", keyPlaceholder: "sk-ant-…" },
	{ id: "openai", label: "OpenAI", group: "ai", keyPlaceholder: "sk-…" },
	{ id: "openrouter", label: "OpenRouter", group: "ai", keyPlaceholder: "sk-or-…" },
	{ id: "google", label: "Google", group: "ai", keyPlaceholder: "AIza…" },
	{
		id: "openai-compatible",
		label: "OpenAI 호환 주소",
		group: "ai",
		hint: "Ollama",
		url: { placeholder: "http://localhost:11434/v1" },
		keyOptional: true,
	},
	{ id: "bareun", label: "바른 맞춤법", group: "plugin", hint: "bareun" },
	{ id: "algolia", label: "Algolia 검색", group: "plugin", hint: "algolia" },
];

const key = (
	id: string,
	name: string,
	service: string,
	tail: string,
	usage: number,
	extra: Partial<ApiKeyView> = {},
): ApiKeyView => ({
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
	...extra,
});

const USES: ApiKeyUse[] = [
	{ plugin: "ai", ref: "quick:claude-haiku-5-5", label: "빠른 작업", value: "claude-haiku-5-5" },
	{ plugin: "ai", ref: "assistant:claude-sonnet-5-5", label: "어시스턴트", value: "claude-sonnet-5-5 · 기본" },
];

const KEYS = [
	key("k1", "Anthropic 개인", "anthropic", "a1b2", 1_240_000, { uses: USES }),
	key("k2", "OpenAI 회사", "openai", "77de", 312_000),
	key("k3", "예전 Gemini 키", "google", "9f0c", 0),
];

const SLOTS: ApiKeySlotView[] = [
	{ plugin: "bareun", slot: "key", label: "맞춤법 검사 키", service: "bareun", key: null },
	{ plugin: "algolia", slot: "search", label: "검색 키", service: "algolia", key: null },
	{ plugin: "algolia", slot: "admin", label: "관리 키", service: "algolia", key: null },
];

const LIST: ApiKeyList = { items: KEYS, secretsAvailable: true, services: SERVICES, slots: SLOTS };

/**
 * The key routes over a list that changes as the story writes: a POST adds the key (or answers `post` instead), a PATCH replaces it, a DELETE takes it
 * out. A key of a slot's service fills the slot, as the server does.
 */
const keysApi = (start: ApiKeyList, post?: () => unknown): FakeApi =>
	(() => {
		let list = start;
		const withSlots = (items: ApiKeyView[]): ApiKeyList => ({
			...list,
			items,
			slots: list.slots.map((slot) => {
				const found = items.find((item) => item.service === slot.service);
				return {
					...slot,
					key: found ? { id: found.id, name: found.name, tail: found.tail, readable: found.readable } : null,
				};
			}),
		});
		return (path: string, method: string, body?: unknown) => {
			if (!path.startsWith("/api/monti/v1/api-keys")) return undefined;
			if (method === "GET") return list;
			if (method === "POST") {
				if (post) return post();
				const input = body as { service: string; name: string; value?: string };
				const added = key(`new-${list.items.length}`, input.name, input.service, input.value?.slice(-4) ?? "", 0);
				list = withSlots([...list.items, added]);
				return added;
			}
			if (method === "PATCH") {
				const id = decodeURIComponent(path.split("/").pop() ?? "");
				const input = body as { name?: string; value?: string };
				list = withSlots(
					list.items.map((item) =>
						item.id === id
							? {
									...item,
									...(input.name ? { name: input.name } : {}),
									...(input.value ? { tail: input.value.slice(-4) } : {}),
								}
							: item,
					),
				);
				return list.items.find((item) => item.id === id);
			}
			return { ok: true };
		};
	})();

const screen = (fake: FakeApi) => () => (
	<PageFrame api={fake} pathname="/admin/tools/api-keys">
		<ApiKeysSettings />
	</PageFrame>
);

const page = (canvasElement: HTMLElement) => within(canvasElement);
const dialog = async () => within(await within(document.body).findByRole("dialog"));
const openAdd = async (canvasElement: HTMLElement, service = "Anthropic") => {
	await userEvent.click(await page(canvasElement).findByRole("button", { name: /키 추가/ }));
	const picker = await dialog();
	await userEvent.click(await picker.findByRole("option", { name: new RegExp(`^${service}`) }));
	return dialog();
};
const KEY = "sk-ant-api03-Qx7mR2vLp9TzW4nB8cKd";

/** 기본: the saved keys with this month's tokens, and the plugins that still need a key. */
export const Loaded: Story = { tags: ["visual"], render: screen(keysApi(LIST)) };

/** 01: "+ 키 추가" picks the service first. */
export const PickService: Story = {
	tags: ["visual"],
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		await userEvent.click(await page(canvasElement).findByRole("button", { name: /키 추가/ }));
		await dialog();
	},
};

/** 02: the service picked; the name is prefilled with its name. */
export const AddKey: Story = {
	tags: ["visual"],
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		await openAdd(canvasElement);
	},
};

/** 02b: an OpenAI-compatible address adds the address field; the name follows its host. */
export const AddCompatible: Story = {
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		const form = await openAdd(canvasElement, "OpenAI 호환 주소");
		await userEvent.type(form.getByLabelText(/주소/), "http://localhost:11434/v1");
	},
};

/** 03: 추가 asks the service first. */
export const Checking: Story = {
	render: screen(keysApi(LIST, () => "pending")),
	play: async ({ canvasElement }) => {
		const form = await openAdd(canvasElement);
		await userEvent.type(form.getByLabelText(/^키\*?$/), KEY);
		await userEvent.click(form.getByRole("button", { name: "추가" }));
	},
};

/** 04: the service refuses the key: one line under it, the dialog stays open. */
export const Rejected: Story = {
	render: screen(keysApi(LIST, () => answer(422, { error: { code: "key_rejected", message: "맞지 않는 키예요." } }))),
	play: async ({ canvasElement }) => {
		const form = await openAdd(canvasElement);
		await userEvent.type(form.getByLabelText(/^키\*?$/), KEY);
		await userEvent.click(form.getByRole("button", { name: "추가" }));
		await form.findByText("맞지 않는 키예요.");
	},
};

/** 05: a key with the service's name exists: the name is prefilled "Anthropic 2", with a line under it. */
export const NameTaken: Story = {
	render: screen(keysApi({ ...LIST, items: [...KEYS, key("k4", "Anthropic", "anthropic", "3f9e", 0)] })),
	play: async ({ canvasElement }) => {
		const form = await openAdd(canvasElement);
		await userEvent.type(form.getByLabelText(/^키\*?$/), KEY);
	},
};

/** 06: added: a new row and a toast. */
export const Added: Story = {
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		const form = await openAdd(canvasElement);
		await userEvent.type(form.getByLabelText(/^키\*?$/), "sk-ant-api03-Qx7mR2vLp9TzW4nB3f9e");
		await userEvent.click(form.getByRole("button", { name: "추가" }));
		await page(canvasElement).findByText("Anthropic");
	},
};

const openEdit = async (canvasElement: HTMLElement, name = "Anthropic 개인") => {
	await userEvent.click(await page(canvasElement).findByRole("button", { name: `편집 ${name}` }));
	return dialog();
};

/** 07: 편집 shows the service as text, the name, and the key as "··· a1b2 · 바꾸기". */
export const Edit: Story = {
	tags: ["visual"],
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		await openEdit(canvasElement);
	},
};

/** 08: 바꾸기 opens an empty key field in place; 그대로 goes back. */
export const EditReplace: Story = {
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		const form = await openEdit(canvasElement);
		await userEvent.click(form.getByRole("button", { name: "바꾸기" }));
	},
};

/** 09: a new key is checked like an added one. */
export const EditChecking: Story = {
	render: screen((path, method) => (method === "PATCH" ? "pending" : keysApi(LIST)(path, method))),
	play: async ({ canvasElement }) => {
		const form = await openEdit(canvasElement);
		await userEvent.click(form.getByRole("button", { name: "바꾸기" }));
		await userEvent.type(form.getByLabelText(/^키\*?$/), KEY);
		await userEvent.click(form.getByRole("button", { name: "저장" }));
	},
};

/** 10: saved: the row's new last characters and a toast. */
export const EditSaved: Story = {
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		const form = await openEdit(canvasElement);
		await userEvent.click(form.getByRole("button", { name: "바꾸기" }));
		await userEvent.type(form.getByLabelText(/^키\*?$/), "sk-ant-api03-Qx7mR2vLp9TzW4nB7c0e");
		await userEvent.click(form.getByRole("button", { name: "저장" }));
		await page(canvasElement).findByText("··· 7c0e");
	},
};

/** 11: deleting a key in use lists what stops. */
export const DeleteUsed: Story = {
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		await userEvent.click(await page(canvasElement).findByRole("button", { name: "지우기 Anthropic 개인" }));
		await within(document.body).findByRole("alertdialog");
	},
};

/** 11b: a key nothing uses is asked about too: it cannot be undone. */
export const DeleteUnused: Story = {
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		await userEvent.click(await page(canvasElement).findByRole("button", { name: "지우기 예전 Gemini 키" }));
		await within(document.body).findByRole("alertdialog");
	},
};

/** 12: a plugin's "키 없음" opens 키 추가 with its service picked. */
export const SlotAdd: Story = {
	tags: ["visual"],
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			(await page(canvasElement).findAllByRole("button", { name: /바른 맞춤법/ }))[0] as HTMLElement,
		);
		await dialog();
	},
};

/** 12b: the key is in: the row names it, and a toast. */
export const SlotAdded: Story = {
	render: screen(keysApi(LIST)),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			(await page(canvasElement).findAllByRole("button", { name: /바른 맞춤법/ }))[0] as HTMLElement,
		);
		const form = await dialog();
		await userEvent.type(form.getByLabelText(/^키\*?$/), "brn-live-0000000004410");
		await userEvent.click(form.getByRole("button", { name: "추가" }));
		// The new key's row, and the slot's row that now names it.
		await page(canvasElement).findAllByText("··· 4410");
	},
};

const UNREADABLE: ApiKeyList = { ...LIST, items: KEYS.map((item) => ({ ...item, readable: false })) };

/** 14: the server secret changed: a banner says why, and each row says it cannot be read. */
export const Unreadable: Story = { render: screen(keysApi(UNREADABLE)) };

/** 14b: 편집 of such a key opens with the key field and asks for it again. */
export const EnterAgain: Story = {
	render: screen(keysApi(UNREADABLE)),
	play: async ({ canvasElement }) => {
		await openEdit(canvasElement);
	},
};

/** 15: no MONTI_SECRET: a banner, and 키 추가 is off. */
export const NoSecret: Story = {
	render: screen(keysApi({ ...LIST, items: [], secretsAvailable: false })),
};

export const Loading: Story = { render: screen(() => "pending") };
export const LoadFailed: Story = { render: screen(() => answer(500)) };
