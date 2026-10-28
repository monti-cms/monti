import { ArrowDown, ArrowUp, Copy, Repeat, TextAlignLeft, TrashCan } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
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
 * The + and the grip in the left margin of an editor block. The + adds an empty block below this one and opens the block picker (the same list as typing "/"). The grip opens the block menu and drags the block; while the menu is open the grip is
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

/** Press the grip to open the block menu. */
export const Playground: Story = { render: () => <BlockMenuDemo defaultOpen={false} /> };

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

function BlockMenuDemo({ defaultOpen = true }: { defaultOpen?: boolean }) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div className="flex min-h-80 max-w-lg items-start gap-monti-12">
			<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
				<BlockHandle
					addLabel="아래에 블록 넣기"
					gripLabel="블록 메뉴"
					active={open}
					trigger={(grip) => <DropdownMenuTrigger render={grip} />}
				/>
				<DropdownMenuContent side="right" align="start">
					<DropdownMenuGroup>
						<DropdownMenuLabel>문단</DropdownMenuLabel>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<Repeat aria-hidden />
								다른 블록으로 바꾸기
							</DropdownMenuSubTrigger>
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
							<DropdownMenuSubTrigger>
								<TextAlignLeft aria-hidden />
								정렬
							</DropdownMenuSubTrigger>
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
					<DropdownMenuItem variant="danger">
						<TrashCan aria-hidden />
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
