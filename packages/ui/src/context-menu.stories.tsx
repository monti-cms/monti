import { Archive, Copy, Folder, Launch, Tag, TrashCan, Undo } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
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
	DropdownMenuCheckboxItem,
	DropdownMenuSearch,
	MenuShortcut,
	Text,
} from "./index";

/** The row menu that opens at the cursor on a right click (232px): an icon on each row, a shortcut or › at the end, the danger row last. */
const meta = {
	title: "Controls/Menu/ContextMenu",
	component: ContextMenu,
} satisfies Meta<typeof ContextMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

const Row = (
	<ContextMenuTrigger>
		<Text>봄에 쓴 첫 글</Text>
	</ContextMenuTrigger>
);

/** A post row: open, copy, the second levels, and the trash at the end. */
export const Post: Story = {
	render: () => (
		<ContextMenu defaultOpen>
			{Row}
			<ContextMenuContent>
				<ContextMenuItem>
					<Launch />
					열기
				</ContextMenuItem>
				<ContextMenuItem>
					<Launch />새 탭에서 열기
				</ContextMenuItem>
				<ContextMenuItem>
					<Copy />
					복제
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuSub defaultOpen>
					<ContextMenuSubTrigger>
						<Folder />
						폴더로
					</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<ContextMenuItem>에세이</ContextMenuItem>
						<ContextMenuItem>작업 노트</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<Tag />
						태그
					</ContextMenuSubTrigger>
				</ContextMenuSub>
				<ContextMenuSeparator />
				<ContextMenuItem>
					<Archive />
					보관
				</ContextMenuItem>
				<ContextMenuItem variant="danger">
					<TrashCan />
					휴지통으로
					<MenuShortcut>Del</MenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
};

/** Several rows picked: the menu starts with how many, holds what the bulk bar holds, and has no icons. */
export const Several: Story = {
	render: () => (
		<ContextMenu defaultOpen>
			{Row}
			<ContextMenuContent>
				<ContextMenuGroup>
					<ContextMenuLabel>2개 항목</ContextMenuLabel>
					<ContextMenuItem>발행</ContextMenuItem>
					<ContextMenuItem>보관</ContextMenuItem>
				</ContextMenuGroup>
				<ContextMenuSub>
					<ContextMenuSubTrigger>폴더로</ContextMenuSubTrigger>
				</ContextMenuSub>
				<ContextMenuSeparator />
				<ContextMenuItem>내보내기</ContextMenuItem>
				<ContextMenuItem variant="danger">
					휴지통으로
					<MenuShortcut>Del</MenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
};

const TAGS = [
	{ name: "리액트", held: "all" },
	{ name: "성능", held: "some", count: "1/2" },
	{ name: "타입스크립트", held: "none" },
	{ name: "넥스트", held: "none" },
] as const;

/** The tags of the picked rows, one level beside: the dropdown menu's search row and check boxes, as they are. A tag some of them hold is mixed. */
function TagsLevel() {
	const [query, setQuery] = useState("");
	return (
		<ContextMenuSub defaultOpen>
			<ContextMenuSubTrigger>태그</ContextMenuSubTrigger>
			<ContextMenuSubContent>
				<DropdownMenuSearch value={query} onValueChange={setQuery} label="태그 찾기" />
				{TAGS.filter((tag) => tag.name.includes(query)).map((tag) => (
					<DropdownMenuCheckboxItem
						key={tag.name}
						box
						checked={tag.held === "all"}
						mixed={tag.held === "some"}
						closeOnClick={false}
					>
						{tag.name}
						{"count" in tag && <MenuShortcut>{tag.count}</MenuShortcut>}
					</DropdownMenuCheckboxItem>
				))}
			</ContextMenuSubContent>
		</ContextMenuSub>
	);
}

/** Several rows, their tags open: a right-click menu takes the dropdown menu's rows as they are. */
export const SeveralTags: Story = {
	render: () => (
		<ContextMenu defaultOpen>
			{Row}
			<ContextMenuContent>
				<ContextMenuGroup>
					<ContextMenuLabel>2개 항목</ContextMenuLabel>
					<ContextMenuItem>발행</ContextMenuItem>
				</ContextMenuGroup>
				<ContextMenuSeparator />
				<ContextMenuSub>
					<ContextMenuSubTrigger>카테고리</ContextMenuSubTrigger>
				</ContextMenuSub>
				<TagsLevel />
			</ContextMenuContent>
		</ContextMenu>
	),
};

/** A trash row: restore, then delete for good. */
export const Trash: Story = {
	render: () => (
		<ContextMenu defaultOpen>
			{Row}
			<ContextMenuContent>
				<ContextMenuItem>
					<Undo />
					복원
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem variant="danger">
					<TrashCan />
					영구 삭제
					<MenuShortcut>Del</MenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
};
