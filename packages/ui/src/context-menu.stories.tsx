import { Copy, FolderMoveTo, FolderOpen, Launch, Tag, TrashCan } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent } from "storybook/test";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "./context-menu";
import { MenuShortcut } from "./menu-parts";
import { Text } from "./text";

/**
 * Opens the menu the way a right click does, at a point inside its target (its center), so a story shows the menu where it would open in use. Base UI
 * places a context menu at the pointer; there is no anchor to hold it open by.
 */
const openAtTarget: NonNullable<Story["play"]> = async ({ canvasElement }) => {
	const target = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
	if (!target) throw new Error("no context menu target");
	const box = target.getBoundingClientRect();
	fireEvent.contextMenu(target, { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 });
};

function Target({ children = "여기를 오른쪽 클릭하세요" }: { children?: string }) {
	return (
		<ContextMenuTrigger className="flex h-32 w-72 items-center justify-center rounded-monti-lg border border-monti-default">
			<Text tone="muted">{children}</Text>
		</ContextMenuTrigger>
	);
}

/** What opens at the cursor on a row or tile: 232px, a 16px icon first, a shortcut or › last, and the red row at the bottom. */
const meta = {
	title: "Controls/Menu/ContextMenu",
	component: ContextMenu,
	args: {},
	render: (args) => (
		<ContextMenu {...args}>
			<Target />
			<ContextMenuContent>
				<ContextMenuItem>
					<FolderOpen aria-hidden />
					열기
				</ContextMenuItem>
				<ContextMenuItem>
					<Launch aria-hidden />새 탭에서 열기
				</ContextMenuItem>
				<ContextMenuItem>
					<Copy aria-hidden />
					복제
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<FolderMoveTo aria-hidden />
						폴더로
					</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<ContextMenuItem>루트</ContextMenuItem>
						<ContextMenuItem>시리즈</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<Tag aria-hidden />
						태그 추가
					</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<ContextMenuItem>리액트</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
				<ContextMenuSeparator />
				<ContextMenuItem variant="danger">
					<TrashCan aria-hidden />
					휴지통으로
					<MenuShortcut>Del</MenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
} satisfies Meta<typeof ContextMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = { play: openAtTarget };

/** A row that cannot be used is faint, and its end says why. */
export const DisabledItems: Story = {
	play: openAtTarget,
	render: () => (
		<ContextMenu>
			<Target>글 목록의 한 줄</Target>
			<ContextMenuContent>
				<ContextMenuItem>
					<FolderOpen aria-hidden />
					열기
				</ContextMenuItem>
				<ContextMenuItem disabled>
					<Copy aria-hidden />
					복제<MenuShortcut>쓰는 중</MenuShortcut>
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem variant="danger" disabled>
					<TrashCan aria-hidden />
					휴지통으로
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
};

/** With several rows picked, the menu starts with their count; what only works on one row (open, copy) is left out. */
export const SeveralRows: Story = {
	play: openAtTarget,
	render: () => (
		<ContextMenu>
			<Target>글 목록의 한 줄</Target>
			<ContextMenuContent>
				<ContextMenuGroup>
					<ContextMenuLabel>2개 항목</ContextMenuLabel>
				</ContextMenuGroup>
				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<FolderMoveTo aria-hidden />
						폴더로
					</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<ContextMenuItem>루트</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
				<ContextMenuSeparator />
				<ContextMenuItem variant="danger">
					<TrashCan aria-hidden />
					휴지통으로
					<MenuShortcut>Del</MenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
};
