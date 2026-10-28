import type { Meta, StoryObj } from "@storybook/react-vite";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import { FilterButton } from "./filter-button";
import { Stack } from "./stack";

/** A condition that is not on yet: its name and a caret, opening a list of values. Once a value is picked it becomes a chip. */
const meta = {
	title: "Patterns/List/FilterButton",
	component: FilterButton,
	args: { children: "태그" },
} satisfies Meta<typeof FilterButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Row: Story = {
	render: () => (
		<Stack direction="row" gap={20} align="center">
			<FilterButton>태그</FilterButton>
			<FilterButton>언어</FilterButton>
			<FilterButton>최근 수정순</FilterButton>
			<FilterButton disabled>비활성</FilterButton>
		</Stack>
	),
};

/** Opening a menu from it. */
export const OpensMenu: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<FilterButton>태그</FilterButton>} />
			<DropdownMenuContent>
				<DropdownMenuItem>리액트</DropdownMenuItem>
				<DropdownMenuItem>타입스크립트</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};
