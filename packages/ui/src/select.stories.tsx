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
import { StoryCaption } from "./story-caption";

/** The label of each value: the closed select shows the chosen item's label, so it needs the list before it is ever opened. */
const CATEGORIES = [
	{ value: "notice", label: "공지사항" },
	{ value: "dev", label: "개발 노트" },
	{ value: "life", label: "일상 (비활성)" },
	{ value: "etc", label: "그 외" },
];

const meta = {
	title: "Controls/Field/Select",
	component: Select,
	args: { items: CATEGORIES },
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
					<StoryCaption>{size}</StoryCaption>
					<Select items={CATEGORIES}>
						<SelectTrigger size={size}>
							<SelectValue placeholder="카테고리 고르기" />
						</SelectTrigger>
						<Items />
					</Select>
					<Select items={CATEGORIES} defaultValue="dev">
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
			<Select items={CATEGORIES} disabled>
				<SelectTrigger>
					<SelectValue placeholder="비활성" />
				</SelectTrigger>
				<Items />
			</Select>
			<Select items={CATEGORIES} defaultValue="notice">
				<SelectTrigger proposal>
					<SelectValue />
				</SelectTrigger>
				<Items />
			</Select>
			<Select items={CATEGORIES} defaultValue="notice">
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
			<Select items={CATEGORIES} defaultOpen defaultValue="dev">
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<Items />
			</Select>
		</Stack>
	),
};
