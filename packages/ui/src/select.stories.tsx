import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "./select";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Controls/Select",
	component: Select,
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

function Items() {
	return (
		<SelectContent>
			<SelectGroup>
				<SelectLabel>카테고리</SelectLabel>
				<SelectItem value="notice">공지사항</SelectItem>
				<SelectItem value="dev">개발 노트</SelectItem>
				<SelectItem value="life" disabled>
					일상 (비활성)
				</SelectItem>
			</SelectGroup>
			<SelectSeparator />
			<SelectGroup>
				<SelectLabel>기타</SelectLabel>
				<SelectItem value="etc">그 외</SelectItem>
			</SelectGroup>
		</SelectContent>
	);
}

export const Playground: Story = {
	render: (args) => (
		<Select {...args}>
			<SelectTrigger>
				<SelectValue placeholder="카테고리 고르기" />
			</SelectTrigger>
			<Items />
		</Select>
	),
};

/** Both trigger sizes, with placeholder and with a value. */
export const Sizes: Story = {
	render: () => (
		<Stack gap={16}>
			{(["sm", "default"] as const).map((size) => (
				<Stack key={size} direction="row" gap={8} align="center">
					<Text variant="caption" tone="muted">
						{size}
					</Text>
					<Select>
						<SelectTrigger size={size}>
							<SelectValue placeholder="카테고리 고르기" />
						</SelectTrigger>
						<Items />
					</Select>
					<Select defaultValue="dev">
						<SelectTrigger size={size}>
							<SelectValue />
						</SelectTrigger>
						<Items />
					</Select>
				</Stack>
			))}
		</Stack>
	),
};

/** Disabled, proposal (the assistant picked it: blue), invalid (red underline). */
export const States: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<Select disabled>
				<SelectTrigger>
					<SelectValue placeholder="비활성" />
				</SelectTrigger>
				<Items />
			</Select>
			<Select defaultValue="notice">
				<SelectTrigger proposal>
					<SelectValue />
				</SelectTrigger>
				<Items />
			</Select>
			<Select defaultValue="notice">
				<SelectTrigger aria-invalid>
					<SelectValue />
				</SelectTrigger>
				<Items />
			</Select>
		</Stack>
	),
};

/** The list open, with a selected item, a group label, a separator and a disabled item. */
export const Open: Story = {
	render: () => (
		<Stack className="min-h-72">
			<Select defaultOpen defaultValue="dev">
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<Items />
			</Select>
		</Stack>
	),
};
