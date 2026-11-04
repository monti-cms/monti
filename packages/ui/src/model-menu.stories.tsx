import type { Meta, StoryObj } from "@storybook/react-vite";
import { MenuField, ModelMenu, ModelMenuButton, Stack } from "./index";

/**
 * The model menu: a search line, the models in groups (recent ones, then one group per key with its count), the current one ticked, and a
 * "Thinking ›" row for a model that can think. Opened by `ModelMenuButton` in the chat input, or by `MenuField` in a settings field.
 */
const meta = {
	title: "Controls/Menu/ModelMenu",
	component: ModelMenu,
} satisfies Meta<typeof ModelMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

const GROUPS = [
	{
		key: "recent",
		label: "최근",
		items: [{ value: "a:claude-sonnet-5-5", model: "claude-sonnet-5-5", hint: "Anthropic 개인" }],
	},
	{
		key: "anthropic",
		label: "Anthropic 개인",
		count: 3,
		items: [
			{ value: "a:claude-opus-5-5", model: "claude-opus-5-5" },
			{ value: "a:claude-sonnet-5-5", model: "claude-sonnet-5-5", hint: "기본" },
			{ value: "a:claude-haiku-5-5", model: "claude-haiku-5-5" },
		],
	},
	{ key: "ollama", label: "Ollama", count: 1, items: [{ value: "o:llama4", model: "llama4" }] },
];

const THINKING = {
	label: "생각",
	value: "high",
	options: [
		{ value: "off", label: "끔" },
		{ value: "low", label: "낮음" },
		{ value: "high", label: "높음" },
	],
	onValueChange: () => {},
};

const base = {
	value: "a:claude-sonnet-5-5",
	onValueChange: () => {},
	groups: GROUPS,
	searchLabel: "모델 찾기",
	emptyText: "맞는 모델이 없어요",
};

/** From the chat input's model button: opens above it, 330px, with the thinking row. */
export const Chat: Story = {
	args: {
		...base,
		open: true,
		thinking: THINKING,
		trigger: <ModelMenuButton model="claude-sonnet-5-5" thinking="생각 높음" label="모델 바꾸기" />,
	},
};

/** From a settings field: opens under the field and takes its width; a model that cannot think has no thinking row. */
export const Field: Story = {
	args: {
		...base,
		open: true,
		layout: "field",
		trigger: <MenuField value="claude-haiku-5-5" meta="Anthropic 개인" mono />,
	},
};

/** The model button at rest: the model in mono, the thinking level after a dot, and a caret. */
export const Button: Story = {
	args: {
		...base,
		open: false,
		trigger: <ModelMenuButton model="claude-opus-5-5" thinking="생각 높음" label="모델 바꾸기" />,
	},
};

/** A menu field without a value: faint placeholder, or the warning ink for a key a plugin still needs. */
export const FieldEmpty: Story = {
	args: { ...base, open: false, trigger: <MenuField placeholder="모델 고르기" /> },
	render: () => (
		<Stack gap={16} width="panel">
			<MenuField placeholder="모델 고르기" />
			<MenuField placeholder="키가 필요해요" warning />
			<MenuField value="sk-ant-…9f2c" meta="Anthropic" mono size="default" />
		</Stack>
	),
};
