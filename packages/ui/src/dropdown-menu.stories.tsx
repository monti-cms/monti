import type { Meta, StoryObj } from "@storybook/react-vite";
import { Archive, Copy, FolderInput, MoreHorizontal, Pencil, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { MenuShortcut, MenuValue } from "./menu-parts";

/**
 * The menu card. Labels are mono; a row can end in a shortcut, a ✓ (the current value of a pick-one list) or a › (it picks a further value, at
 * the side). The pointed row and the row whose second level is open take the selected background. What cannot be undone is last, in red.
 */
const meta = {
	title: "Overlays/DropdownMenu",
	component: DropdownMenu,
	args: {},
	render: (args) => (
		<DropdownMenu {...args}>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>
				<MoreHorizontal aria-hidden />더 보기
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>
					<Pencil aria-hidden />
					이름 바꾸기
				</DropdownMenuItem>
				<DropdownMenuItem>
					<Copy aria-hidden />
					복제
					<MenuShortcut>⌘D</MenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger">
					<Trash2 aria-hidden />
					휴지통으로
					<MenuShortcut>Del</MenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
} satisfies Meta<typeof DropdownMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = { args: { defaultOpen: true }, render: meta.render };

/** A group's name, shortcuts at the end, rows that go to the editor's block commands. */
export const GroupsAndLabels: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>블록</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuGroup>
					<DropdownMenuLabel>문단</DropdownMenuLabel>
					<DropdownMenuItem>
						위로<MenuShortcut>⌥↑</MenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem>
						아래로<MenuShortcut>⌥↓</MenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem>
						복제<MenuShortcut>⇧⌘D</MenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger">
					삭제<MenuShortcut>⇧⌘⌫</MenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

/** A row that cannot be used is faint, and its end says why. */
export const DisabledItems: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>글 작업</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>
					<Pencil aria-hidden />
					이름 바꾸기
				</DropdownMenuItem>
				<DropdownMenuItem disabled>
					<Archive aria-hidden />
					보관<MenuShortcut>쓰는 중</MenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger" disabled>
					<Trash2 aria-hidden />
					휴지통으로
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

function CheckboxDemo() {
	const [showDrafts, setShowDrafts] = useState(true);
	const [showTrash, setShowTrash] = useState(false);
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>열</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuCheckboxItem checked={showDrafts} onCheckedChange={setShowDrafts}>
					초안
				</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem checked={showTrash} onCheckedChange={setShowTrash}>
					휴지통
				</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem checked disabled>
					발행됨
				</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Several can be on: each row that is on ends in a ✓. */
export const CheckboxItems: Story = { render: () => <CheckboxDemo /> };

function RadioDemo() {
	const [order, setOrder] = useState("recent");
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>정렬</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup value={order} onValueChange={setOrder}>
					<DropdownMenuRadioItem value="recent">최근 수정순</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="title">제목순</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="old" disabled>
						오래된 순
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Pick one: the current value is a ✓ at the end, never a background. */
export const PickOne: Story = { render: () => <RadioDemo /> };

function SubmenuDemo() {
	const [by, setBy] = useState("modified");
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>보기</DropdownMenuTrigger>
			<DropdownMenuContent className="min-w-64">
				<DropdownMenuSub defaultOpen>
					<DropdownMenuSubTrigger>
						정렬<MenuValue>수정한 날 · 최신순</MenuValue>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuRadioGroup value={by} onValueChange={setBy}>
							<DropdownMenuRadioItem value="modified">수정한 날</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="published">발행한 날</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="created">만든 날</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="title">제목</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						열<MenuValue>5개</MenuValue>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuCheckboxItem checked>상태</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem checked>태그</DropdownMenuCheckboxItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						쪽마다<MenuValue>25</MenuValue>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem>25</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * A row that picks a further value ends in a › (after its current value, faint) and opens a second level at the side: pointing at it or →
 * opens, ← closes. The row stays selected while its level is open, and the current value inside is a ✓. There is no third level.
 */
export const SideSubmenu: Story = { render: () => <SubmenuDemo /> };

/** Rows that open a second level next to ordinary rows and a red one. */
export const MixedRows: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>글 작업</DropdownMenuTrigger>
			<DropdownMenuContent className="min-w-56">
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<FolderInput aria-hidden />
						폴더로
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem>루트</DropdownMenuItem>
						<DropdownMenuItem>시리즈</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Tag aria-hidden />
						태그 추가
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem>리액트</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger">
					<Trash2 aria-hidden />
					휴지통으로
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

/** The card is capped at 20rem wide: a long label is cut instead of stretching the menu. */
export const LongLabel: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>글 고르기</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>
					<span className="truncate">아주 긴 제목의 글이 메뉴 안에서 어떻게 보이는지 확인하기 위한 제목입니다</span>
				</DropdownMenuItem>
				<DropdownMenuItem>짧은 글</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};
