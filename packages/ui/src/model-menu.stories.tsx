import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ChatInput } from "./chat-input";
import { MenuField, ModelMenu, ModelMenuButton, type ModelMenuGroup } from "./model-menu";

const GROUPS: ModelMenuGroup[] = [
	{
		key: "recent",
		label: "최근",
		items: [
			{ value: "a/claude-sonnet-5-5", model: "claude-sonnet-5-5", hint: "기본" },
			{ value: "o/openai/gpt-5", model: "openai/gpt-5", hint: "OpenRouter" },
		],
	},
	{
		key: "a",
		label: "Anthropic 개인",
		count: 3,
		items: [
			{ value: "a/claude-opus-5-5", model: "claude-opus-5-5" },
			{ value: "a/claude-haiku-5-5", model: "claude-haiku-5-5" },
		],
	},
	{
		key: "o",
		label: "OpenRouter",
		count: 312,
		items: [
			{ value: "o/anthropic/claude-opus-5-5", model: "anthropic/claude-opus-5-5" },
			{ value: "o/deepseek/deepseek-chat", model: "deepseek/deepseek-chat" },
			{ value: "o/google/gemini-2.5-pro", model: "google/gemini-2.5-pro" },
		],
	},
];

const LEVELS = [
	{ value: "off", label: "끔" },
	{ value: "low", label: "낮음" },
	{ value: "medium", label: "보통" },
	{ value: "high", label: "높음" },
];

/**
 * The model menu of the chat input (flow 2 · 23): a search line, the recent models, then the models of each key with its count, and "생각 ›" for a model
 * that can think. The quick-task model on the API keys screen opens the same menu under a field, without recent models or thinking (flow 10 · 13).
 */
const meta = {
	title: "Monti/Assistant/ModelMenu",
	component: ModelMenu,
	args: {
		value: "a/claude-sonnet-5-5",
		onValueChange: () => undefined,
		groups: GROUPS,
		searchLabel: "모델 찾기",
		emptyText: "맞는 모델이 없어요",
		trigger: <ModelMenuButton model="claude-sonnet-5-5" thinking="생각 보통" label="모델 고르기" />,
	},
	decorators: [
		(Story) => (
			<div style={{ width: 380, paddingTop: 460, paddingLeft: 16 }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ModelMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Pick a model and a thinking level: the button follows. A model that cannot think drops the level. */
export const Playground: Story = {
	render: (args) => {
		const [value, setValue] = useState("a/claude-sonnet-5-5");
		const [thinking, setThinking] = useState("medium");
		const model = value.slice(value.indexOf("/") + 1);
		const thinks = !model.startsWith("deepseek") && !model.startsWith("meta");
		const level = LEVELS.find((option) => option.value === thinking)?.label;
		return (
			<ChatInput
				value=""
				onValueChange={() => undefined}
				onSubmit={() => undefined}
				onStop={() => undefined}
				label="어시스턴트에게 묻기"
				placeholder="이 글에 대해 물어보세요"
				sendLabel="보내기"
				stopLabel="멈추기"
				aside={
					<ModelMenu
						{...args}
						value={value}
						onValueChange={setValue}
						trigger={
							<ModelMenuButton
								model={model}
								label="모델 고르기"
								{...(thinks && thinking !== "off" ? { thinking: `생각 ${level}` } : {})}
							/>
						}
						{...(thinks
							? { thinking: { label: "생각", value: thinking, options: LEVELS, onValueChange: setThinking } }
							: {})}
					/>
				}
			/>
		);
	},
};

/** Open (flow 2 · 23). */
export const Open: Story = {
	args: { open: true, thinking: { label: "생각", value: "medium", options: LEVELS, onValueChange: () => undefined } },
};

/** A model that cannot think: no 생각 row (flow 2 · 23d). */
export const NoThinking: Story = {
	args: {
		open: true,
		value: "o/deepseek/deepseek-chat",
		trigger: <ModelMenuButton model="deepseek/deepseek-chat" label="모델 고르기" />,
	},
};

/** The quick-task model as a field: the menu opens under it and takes its width (flow 10 · 13). */
export const Field: Story = {
	decorators: [
		(Story) => (
			<div style={{ width: 320, marginLeft: 200 }}>
				<Story />
			</div>
		),
	],
	args: {
		open: true,
		layout: "field",
		value: "a/claude-haiku-5-5",
		groups: GROUPS.slice(1),
		trigger: <MenuField mono value="claude-haiku-5-5" meta="Anthropic 개인" />,
	},
};

/** No key yet: the field says so and does not open. */
export const FieldEmpty: Story = {
	decorators: Field.decorators,
	render: () => <MenuField placeholder="키 없음" disabled />,
};
