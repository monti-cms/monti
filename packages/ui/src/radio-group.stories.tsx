import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioGroup, RadioItem } from "./radio-group";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Controls/RadioGroup",
	component: RadioGroup,
	args: { variant: "plain", defaultValue: "all" },
	render: (args) => (
		<RadioGroup {...args} className="max-w-sm">
			<RadioItem value="all" label="모든 글" hint="초안과 발행된 글을 모두 내보내요" />
			<RadioItem value="published" label="발행된 글만" />
			<RadioItem value="draft" label="초안만" />
		</RadioGroup>
	),
} satisfies Meta<typeof RadioGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
	render: () => (
		<Stack gap={24}>
			{(["plain", "card"] as const).map((variant) => (
				<Stack key={variant} gap={4}>
					<Text variant="label" tone="muted">
						variant {variant}
					</Text>
					<RadioGroup variant={variant} defaultValue="all" className="max-w-sm">
						<RadioItem value="all" label="모든 글" hint="초안과 발행된 글을 모두 내보내요" />
						<RadioItem value="published" label="발행된 글만" hint="공개된 글만 내보내요" />
						<RadioItem value="draft" label="초안만" />
					</RadioGroup>
				</Stack>
			))}
		</Stack>
	),
};

/** Options with and without a hint, and a disabled one. */
export const ItemStates: Story = {
	render: () => (
		<Stack gap={24}>
			{(["plain", "card"] as const).map((variant) => (
				<Stack key={variant} gap={4}>
					<Text variant="label" tone="muted">
						variant {variant}, disabled
					</Text>
					<RadioGroup variant={variant} defaultValue="published" className="max-w-sm">
						<RadioItem value="published" label="발행된 글만" hint="선택된 상태" />
						<RadioItem value="draft" label="초안만" hint="선택하지 않은 상태" />
						<RadioItem value="private" label="비공개 글" hint="사용할 수 없어요" disabled />
					</RadioGroup>
				</Stack>
			))}
		</Stack>
	),
};

export const GroupDisabled: Story = {
	render: () => (
		<RadioGroup disabled defaultValue="all" className="max-w-sm">
			<RadioItem value="all" label="모든 글" />
			<RadioItem value="draft" label="초안만" />
		</RadioGroup>
	),
};
