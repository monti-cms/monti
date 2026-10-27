import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { Block, BlockHandle } from "./block-handle";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { MenuShortcut } from "./menu-parts";
import { Stack } from "./stack";
import { Text } from "./text";

/**
 * The + and the grip in the left margin of an editor block. The grip opens the block menu and drags the block; while the menu is open the grip is
 * pressed and the block has the block background.
 */
const meta = {
	title: "Monti/EditorTools/BlockHandle",
	component: BlockHandle,
	args: { addLabel: "아래에 블록 넣기", gripLabel: "블록 메뉴" },
} satisfies Meta<typeof BlockHandle>;
export default meta;
type Story = StoryObj<typeof meta>;

const TEXT = "블로그를 다시 만들기로 한 건 도구를 고치는 시간이 길어졌기 때문이다.";

export const Playground: Story = {
	render: (args) => (
		<div className="flex items-start gap-monti-12">
			<BlockHandle {...args} />
			<Block>
				<Text variant="reading">{TEXT}</Text>
			</Block>
		</div>
	),
};

/** At rest, and with the menu open (the grip pressed, the block shaded). */
export const States: Story = {
	render: (args) => (
		<Stack gap={24}>
			<div className="flex max-w-lg items-start gap-monti-12">
				<BlockHandle {...args} />
				<Block className="max-w-md">
					<Text variant="reading">{TEXT}</Text>
				</Block>
			</div>
			<div className="flex max-w-lg items-start gap-monti-12">
				<BlockHandle {...args} active />
				<Block active className="max-w-md">
					<Text variant="reading">{TEXT}</Text>
				</Block>
			</div>
		</Stack>
	),
};

function BlockMenuDemo() {
	const [open, setOpen] = useState(true);
	return (
		<div className="flex min-h-80 max-w-lg items-start gap-monti-12">
			<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
				<BlockHandle
					addLabel="아래에 블록 넣기"
					gripLabel="블록 메뉴"
					active={open}
					trigger={(grip) => <DropdownMenuTrigger render={grip} />}
				/>
				<DropdownMenuContent side="right" align="start" className="min-w-56">
					<DropdownMenuGroup>
						<DropdownMenuLabel>문단</DropdownMenuLabel>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>다른 블록으로 바꾸기</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuItem>문단</DropdownMenuItem>
								<DropdownMenuItem>
									제목 2<MenuShortcut>##</MenuShortcut>
								</DropdownMenuItem>
								<DropdownMenuItem>
									제목 3<MenuShortcut>###</MenuShortcut>
								</DropdownMenuItem>
								<DropdownMenuItem>
									목록<MenuShortcut>-</MenuShortcut>
								</DropdownMenuItem>
								<DropdownMenuItem>
									인용<MenuShortcut>&gt;</MenuShortcut>
								</DropdownMenuItem>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>정렬</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuItem>왼쪽</DropdownMenuItem>
								<DropdownMenuItem>가운데</DropdownMenuItem>
								<DropdownMenuItem>오른쪽</DropdownMenuItem>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem>
						<ArrowUp aria-hidden />
						위로<MenuShortcut>⌥↑</MenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<ArrowDown aria-hidden />
						아래로<MenuShortcut>⌥↓</MenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<Copy aria-hidden />
						복제<MenuShortcut>⇧⌘D</MenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="danger">
						<Trash2 aria-hidden />
						삭제<MenuShortcut>⇧⌘⌫</MenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Block active={open} className="max-w-md">
				<Text variant="reading">{TEXT}</Text>
			</Block>
		</div>
	);
}

/** The block menu: the kind of block, change into another block and align (›), move, copy, delete. */
export const WithMenu: Story = { render: () => <BlockMenuDemo /> };
