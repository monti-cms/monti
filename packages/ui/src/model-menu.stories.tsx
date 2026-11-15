import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { Inline, MenuField, ModelMenu, ModelMenuButton, Stack, ThinkingMenu } from "./index";

/**
 * The model menu: a search line, the models in groups (recent ones, then one group per key with its count), each by its name with its price at the
 * end, the current one ticked; the id, the price in words and what an alias stands for in the row's tooltip. Opened by `ModelMenuButton` in the
 * chat input, with `ThinkingMenu` beside it for a model that thinks, or by `MenuField` in a settings field.
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
		items: [
			{
				value: "o:anthropic/claude-sonnet-5.5",
				model: "Anthropic: Claude Sonnet 5.5",
				id: "anthropic/claude-sonnet-5.5",
				hint: "$3 · $15 · OpenRouter",
			},
		],
	},
	{
		key: "openrouter",
		label: "OpenRouter",
		count: 4,
		items: [
			{
				value: "o:~anthropic/claude-sonnet-latest",
				model: "Anthropic: Claude Sonnet Latest",
				id: "~anthropic/claude-sonnet-latest",
				title: "~anthropic/claude-sonnet-latest\n지금: Anthropic: Claude Sonnet 5.5",
				hint: "$3 · $15",
			},
			{
				value: "o:anthropic/claude-sonnet-5.5",
				model: "Anthropic: Claude Sonnet 5.5",
				id: "anthropic/claude-sonnet-5.5",
				title: "anthropic/claude-sonnet-5.5\n100만 토큰당 입력 $3, 출력 $15\n입력 한도 1M 토큰",
				hint: "$3 · $15 · 기본",
			},
			{
				value: "o:meta-llama/llama-4-maverick:free",
				model: "Meta: Llama 4 Maverick (free)",
				id: "meta-llama/llama-4-maverick:free",
				hint: "무료",
			},
			{
				value: "o:openai/gpt-5.4-mini",
				model: "OpenAI: GPT-5.4 Mini",
				id: "openai/gpt-5.4-mini",
				hint: "$0.25 · $2",
			},
		],
	},
	{ key: "ollama", label: "Ollama", count: 1, items: [{ value: "l:llama4", model: "llama4" }] },
];

const LEVELS = [
	{ value: "low", label: "낮음" },
	{ value: "medium", label: "보통" },
	{ value: "high", label: "높음" },
];

const base = {
	value: "o:anthropic/claude-sonnet-5.5",
	onValueChange: () => {},
	groups: GROUPS,
	searchLabel: "모델 찾기",
	emptyText: "맞는 모델이 없어요",
};

/** From the chat input's model button: opens above it, 330px. */
export const Chat: Story = {
	args: {
		...base,
		open: true,
		trigger: <ModelMenuButton model="Anthropic: Claude Sonnet 5.5" label="모델 바꾸기" />,
	},
};

/** From a settings field: opens under the field and takes its width. The field shows the model's name, then its price and key. */
export const Field: Story = {
	args: {
		...base,
		open: true,
		layout: "field",
		trigger: <MenuField value="Meta: Llama 4 Maverick (free)" meta="무료 · OpenRouter" />,
	},
};

/** The model button at rest, its name and a caret, with the thinking button beside it for a model that thinks. */
export const Button: Story = {
	args: {
		...base,
		open: false,
		trigger: <ModelMenuButton model="Anthropic: Claude Sonnet 5.5" label="모델 바꾸기" />,
	},
	render: (args) => (
		<Inline gap={2}>
			<ModelMenu {...args} />
			<ThinkingMenu value="medium" options={LEVELS} onValueChange={() => {}} label="생각" text="생각 보통" />
		</Inline>
	),
};

/** The thinking button's menu: only the levels the model takes (this one cannot stop thinking), the current one ticked. */
export const Thinking: Story = {
	args: { ...base, open: false, trigger: <ModelMenuButton model="Anthropic: Claude Sonnet 5.5" label="모델 바꾸기" /> },
	render: (args) => (
		<Inline gap={2}>
			<ModelMenu {...args} />
			<ThinkingMenu value="medium" options={LEVELS} onValueChange={() => {}} label="생각" text="생각 보통" />
		</Inline>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole("button", { name: "생각" }));
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

/** While a search filters the models, each group's count is the models it found there (ST-32): "OpenRouter 2", Ollama gone. */
export const Searched: Story = {
	tags: ["visual"],
	args: { ...base, open: true, trigger: <ModelMenuButton model="Anthropic: Claude Sonnet 5.5" label="모델 바꾸기" /> },
	play: async ({ canvasElement }) => {
		const search = await within(canvasElement.ownerDocument.body).findByRole("textbox", { name: "모델 찾기" });
		await userEvent.type(search, "anthropic");
	},
};
