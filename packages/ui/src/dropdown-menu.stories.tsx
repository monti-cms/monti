import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Archive, Copy, Folder, Launch, OverflowMenuHorizontal, Tag, TrashCan } from "./icons";
import {
	Button,
	Caret,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuScroll,
	DropdownMenuSearch,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	IconButton,
	MenuShortcut,
	MenuValue,
} from "./index";

/** The floating menu card: 240px, rows with an icon, a name and a shortcut; what cannot be undone is last, in red. */
const meta = {
	title: "Controls/Menu/DropdownMenu",
	component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

const More = (
	<IconButton label="더 보기" trigger={(button) => <DropdownMenuTrigger render={button} />}>
		<OverflowMenuHorizontal />
	</IconButton>
);

/** The ⋯ menu of a post: actions, a rule, and the danger row at the bottom. */
export const Actions: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			{More}
			<DropdownMenuContent>
				<DropdownMenuItem>
					<Launch />새 탭에서 열기
				</DropdownMenuItem>
				<DropdownMenuItem>
					<Copy />
					복제
					<MenuShortcut keys={["mod", "shift", "D"]} />
				</DropdownMenuItem>
				<DropdownMenuItem>
					<Archive />
					보관
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger">
					<TrashCan />
					휴지통으로
					<MenuShortcut>Del</MenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

/** A row that needs one more value opens a second level at its side; the row shows the current value faintly. */
export const SecondLevel: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			{More}
			<DropdownMenuContent>
				<DropdownMenuItem>
					<Copy />
					복제
				</DropdownMenuItem>
				<DropdownMenuSub defaultOpen>
					<DropdownMenuSubTrigger>
						<Folder />
						폴더로
						<MenuValue>에세이</MenuValue>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuRadioGroup value="essay">
							<DropdownMenuRadioItem value="none">폴더 없음</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="essay">에세이</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="notes">작업 노트</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Tag />
						태그
					</DropdownMenuSubTrigger>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

/** Picking one value: the current one has a ✓ at its end; picking applies it and closes the menu. Opened from a text button. */
export const PickOne: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger
				render={
					<Button variant="ghost" size="sm">
						최근 수정 <Caret />
					</Button>
				}
			/>
			<DropdownMenuContent>
				<DropdownMenuGroup>
					<DropdownMenuLabel>정렬</DropdownMenuLabel>
					<DropdownMenuRadioGroup value="updated">
						<DropdownMenuRadioItem value="updated">최근 수정</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="published">발행일</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="title">제목</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

/** Values several of which can be on start with a check box; a value some of the picked rows hold is mixed, with `n/N` at the end. */
export const CheckBoxes: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			{More}
			<DropdownMenuContent>
				<DropdownMenuGroup>
					<DropdownMenuLabel>태그</DropdownMenuLabel>
					<DropdownMenuCheckboxItem box checked closeOnClick={false}>
						회고
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem box mixed closeOnClick={false}>
						에디터
						<MenuShortcut>1/2</MenuShortcut>
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem box checked={false} closeOnClick={false}>
						디자인
					</DropdownMenuCheckboxItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

const BLOCKS = [
	"문단",
	"소제목",
	"목록",
	"인용",
	"구분선",
	"이미지",
	"표",
	"코드 블록",
	"파일",
	"다른 글 링크",
	"각주",
];

/** A long menu: a search row on top and a list that scrolls inside at 320px. */
export const Search: Story = {
	render: function Render() {
		const [query, setQuery] = useState("");
		const rows = BLOCKS.filter((name) => name.includes(query));
		return (
			<DropdownMenu defaultOpen>
				{More}
				<DropdownMenuContent>
					<DropdownMenuSearch value={query} onValueChange={setQuery} label="블록 찾기" />
					<DropdownMenuScroll>
						{rows.map((name) => (
							<DropdownMenuItem key={name}>{name}</DropdownMenuItem>
						))}
					</DropdownMenuScroll>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	},
};

/** A row with a second line that says what it leaves alone. */
export const Caption: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			{More}
			<DropdownMenuContent>
				<DropdownMenuItem caption="한국어 원문은 그대로 둬요">영어로 번역</DropdownMenuItem>
				<DropdownMenuItem caption="한국어 원문은 그대로 둬요">일본어로 번역</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger" icon={<TrashCan aria-hidden />} caption="한국어 원문은 그대로">
					이 번역 휴지통으로
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};
