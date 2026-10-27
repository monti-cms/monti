import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, ExternalLink, FolderInput, FolderOpen, Tag, Trash2 } from "lucide-react";
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

function Target({ children = "여기를 오른쪽 클릭하세요" }: { children?: string }) {
	return (
		<ContextMenuTrigger className="flex h-32 w-72 items-center justify-center rounded-monti-lg border border-monti-muted border-dashed">
			<Text tone="muted">{children}</Text>
		</ContextMenuTrigger>
	);
}

/** What opens at the cursor on a row or tile: 232px, a 16px icon first, a shortcut or › last, and the red row at the bottom. */
const meta = {
	title: "Overlays/ContextMenu",
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
					<ExternalLink aria-hidden />새 탭에서 열기
				</ContextMenuItem>
				<ContextMenuItem>
					<Copy aria-hidden />
					복제
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<FolderInput aria-hidden />
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
					<Trash2 aria-hidden />
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

export const Open: Story = { args: { open: true }, render: meta.render };

/** A row that cannot be used is faint, and its end says why. */
export const DisabledItems: Story = {
	render: () => (
		<ContextMenu open>
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
					<Trash2 aria-hidden />
					휴지통으로
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
};

/** With several rows picked, the menu starts with their count; what only works on one row (open, copy) is left out. */
export const SeveralRows: Story = {
	render: () => (
		<ContextMenu open>
			<Target>글 목록의 한 줄</Target>
			<ContextMenuContent>
				<ContextMenuGroup>
					<ContextMenuLabel>2개 항목</ContextMenuLabel>
				</ContextMenuGroup>
				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<FolderInput aria-hidden />
						폴더로
					</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<ContextMenuItem>루트</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
				<ContextMenuSeparator />
				<ContextMenuItem variant="danger">
					<Trash2 aria-hidden />
					휴지통으로
					<MenuShortcut>Del</MenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
};
