import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { answer, type FakeApi, ScreenFrame } from "../../stories/screen-frame";
import { ApiKeysSettings } from "./api-keys-settings";

const meta = { title: "Screens/API keys/API keys", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

type Use = { plugin: string; ref: string; label: string };
const key = (id: string, name: string, tail: string, uses: Use[] = [], readable = true) => ({
	id,
	name,
	tail,
	readable,
	version: 1,
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-10-01T00:00:00.000Z",
	uses,
	slots: uses.filter((use) => use.plugin === "speller"),
});
const emptySlot = { plugin: "speller", slot: "key", label: "맞춤법 검사", service: "Speller", key: null };

const keys = [
	key("k1", "Anthropic", "91c0", [
		{ plugin: "ai", ref: "connection:a", label: "AI 연결 “Claude”" },
		{ plugin: "ai", ref: "connection:b", label: "AI 연결 “번역”" },
	]),
	key("k2", "예비 키", "77e1"),
	key("k3", "OpenRouter", "08ab", [], false),
];

const list =
	(
		body: { items: unknown[]; slots?: unknown[]; secretsAvailable?: boolean },
		onWrite: FakeApi = () => ({ ok: true }),
	): FakeApi =>
	(path, method) => {
		if (path === "/api/monti/v1/api-keys" && method === "GET") return { slots: [], secretsAvailable: true, ...body };
		if (path.startsWith("/api/monti/v1/api-keys")) return onWrite(path, method);
		return undefined;
	};

const screen = (fake: FakeApi) => () => (
	<ScreenFrame api={fake} title="API 키" nav="api-keys" pathname="/admin/api-keys">
		<ApiKeysSettings />
	</ScreenFrame>
);

export const Loaded: Story = { render: screen(list({ items: keys, slots: [emptySlot] })) };
export const Empty: Story = { render: screen(list({ items: [] })) };
export const SecretsUnavailable: Story = {
	render: screen(list({ items: keys, slots: [emptySlot], secretsAvailable: false })),
};
export const Loading: Story = { render: screen(() => "pending") };
export const LoadFailed: Story = { render: screen(() => answer(500)) };
export const AddKeyDialog: Story = {
	render: screen(list({ items: keys, slots: [emptySlot] })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "키 추가" }));
		await within(document.body).findByRole("dialog");
	},
};
export const AssignSlotDialog: Story = {
	render: screen(list({ items: keys, slots: [emptySlot] })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "키 넣기" }));
		await within(document.body).findByRole("dialog");
	},
};
/** The new-key option picked: the key input and its note sit under the radio group, not in the row. */
export const AssignSlotNewKey: Story = {
	render: screen(list({ items: keys, slots: [emptySlot] })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "키 넣기" }));
		const dialog = within(await within(document.body).findByRole("dialog"));
		await userEvent.click(await dialog.findByRole("radio", { name: "새 키 넣기" }));
		await dialog.findByLabelText("새 API 키");
	},
};
/** No saved key yet: the first option is disabled, and the note says why, under the group. */
export const AssignSlotNoSavedKeys: Story = {
	render: screen(list({ items: [], slots: [emptySlot] })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "키 넣기" }));
		await within(document.body).findByRole("dialog");
	},
};
export const SaveFailed: Story = {
	render: screen(
		list({ items: keys }, () =>
			answer(500, { error: { code: "internal", message: "키를 저장하지 못했어요. 잠시 뒤에 다시 해 주세요." } }),
		),
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "키 추가" }));
		const dialog = within(await within(document.body).findByRole("dialog"));
		await userEvent.type(dialog.getByLabelText("이름"), "새 키");
		await userEvent.type(dialog.getByLabelText("키"), "sk-test-1234");
		await userEvent.click(dialog.getByRole("button", { name: "키 추가" }));
		await dialog.findByText(/저장하지 못했어요/);
	},
};
/** Deleting a key that something still uses lists what stops. */
export const DeleteWithDependents: Story = {
	render: screen(list({ items: keys, slots: [emptySlot] })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "Anthropic 메뉴" }));
		await userEvent.click(await within(document.body).findByRole("menuitem", { name: "지우기" }));
		await within(document.body).findByTestId("delete-dependents");
	},
};
export const DeleteUnused: Story = {
	render: screen(list({ items: keys, slots: [emptySlot] })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "예비 키 메뉴" }));
		await userEvent.click(await within(document.body).findByRole("menuitem", { name: "지우기" }));
		await within(document.body).findByRole("alertdialog");
	},
};
