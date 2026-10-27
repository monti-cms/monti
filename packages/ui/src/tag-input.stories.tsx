import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import { Stack } from "./stack";
import { TagInput } from "./tag-input";
import { Text } from "./text";

const meta = {
	title: "Controls/TagInput",
	component: TagInput,
	args: {
		items: ["여행", "일상"],
		onChange: () => {},
		placeholder: "태그를 입력하세요",
		removeLabel: (item) => `${item} 삭제`,
		"aria-label": "태그",
	},
	// Keeps the chips in state, so adding and removing work in the Playground.
	render: (args) => {
		const [items, setItems] = useState<string[]>([...args.items]);
		return (
			<div className="max-w-sm">
				<TagInput {...args} items={items} onChange={setItems} />
			</div>
		);
	},
} satisfies Meta<typeof TagInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Static({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Stack gap={4}>
			<Text variant="label" tone="muted">
				{label}
			</Text>
			<div className="max-w-sm">{children}</div>
		</Stack>
	);
}

export const Empty: Story = {
	args: { items: [] },
};

export const Disabled: Story = {
	render: () => (
		<Static label="disabled true">
			<TagInput items={["여행", "일상"]} onChange={() => {}} removeLabel={(item) => `${item} 삭제`} disabled />
		</Static>
	),
};

export const Mono: Story = {
	render: () => (
		<Stack gap={12}>
			{[false, true].map((mono) => (
				<Static key={String(mono)} label={`mono ${mono}`}>
					<TagInput
						items={["title", "published_at"]}
						onChange={() => {}}
						removeLabel={(item) => `${item} 삭제`}
						mono={mono}
					/>
				</Static>
			))}
		</Stack>
	),
};

export const LongValue: Story = {
	render: () => (
		<Static label="긴 값은 말줄임">
			<TagInput
				items={["아주아주아주아주아주아주아주 긴 태그 이름입니다", "짧은 태그"]}
				onChange={() => {}}
				removeLabel={(item) => `${item} 삭제`}
			/>
		</Static>
	),
};
