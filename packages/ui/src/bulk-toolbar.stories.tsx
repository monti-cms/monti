import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { BulkToolbar } from "./bulk-toolbar";
import { Caret } from "./caret";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import type { SelectAllState } from "./page-header";
import { TextButton } from "./text-button";

/**
 * The bar a grid shows while tiles are picked, in the place of its filter row: the count, the actions, and the way to let go. The select-all check hangs
 * in the left margin; it is a bar while only some are picked and a ✓ when all are.
 */
const meta = {
	title: "Patterns/List/Bulk toolbar",
	component: BulkToolbar,
	args: { label: "2개 선택", clearLabel: "선택 해제", onClear: () => {} },
	decorators: [
		(Story) => (
			<div className="w-[880px] max-w-full pl-monti-32">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof BulkToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

function Actions({ defaultOpen = false }: { defaultOpen?: boolean }) {
	return (
		<>
			<DropdownMenu defaultOpen={defaultOpen}>
				<DropdownMenuTrigger render={<TextButton />}>
					폴더로
					<Caret />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuItem>최상위</DropdownMenuItem>
					<DropdownMenuItem>Blog Assets</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem>+ 새 폴더</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<TextButton>휴지통으로</TextButton>
		</>
	);
}

export const Some: Story = {
	render: (args) => {
		const [state, setState] = useState<SelectAllState>("some");
		return (
			<BulkToolbar
				{...args}
				selectAll={{ state, onChange: (all) => setState(all ? "all" : "none"), label: "전체 선택" }}
			>
				<Actions />
			</BulkToolbar>
		);
	},
};

export const All: Story = {
	render: (args) => (
		<BulkToolbar {...args} label="3개 선택" selectAll={{ state: "all", onChange: () => {}, label: "전체 선택" }}>
			<Actions />
		</BulkToolbar>
	),
};

/** The folder menu open. */
export const FolderMenuOpen: Story = {
	render: (args) => (
		<div className="min-h-64">
			<BulkToolbar {...args} selectAll={{ state: "some", onChange: () => {}, label: "전체 선택" }}>
				<Actions defaultOpen />
			</BulkToolbar>
		</div>
	),
};
