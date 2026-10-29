import { Archive, Copy, Edit, FolderMoveTo, OverflowMenuHorizontal, Tag, TrashCan } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
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
	DropdownMenuScroll,
	DropdownMenuSearch,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { FilterButton } from "./filter-button";
import { MenuShortcut, MenuValue } from "./menu-parts";

/**
 * The menu card. Labels are mono; a row can end in a shortcut, a ✓ (the current value of a pick-one list) or a › (it picks a further value, at
 * the side). The pointed row and the row whose second level is open take the selected background. What cannot be undone is last, in red.
 */
const meta = {
	title: "Controls/Menu/DropdownMenu",
	component: DropdownMenu,
	args: {},
	render: (args) => (
		<DropdownMenu {...args}>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>
				<OverflowMenuHorizontal aria-hidden />더 보기
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>
					<Edit aria-hidden />
					이름 바꾸기
				</DropdownMenuItem>
				<DropdownMenuItem>
					<Copy aria-hidden />
					복제
					<MenuShortcut keys={["mod", "D"]} />
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger">
					<TrashCan aria-hidden />
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
						위로
						<MenuShortcut keys={["alt", "ArrowUp"]} />
					</DropdownMenuItem>
					<DropdownMenuItem>
						아래로
						<MenuShortcut keys={["alt", "ArrowDown"]} />
					</DropdownMenuItem>
					<DropdownMenuItem>
						복제
						<MenuShortcut keys={["mod", "shift", "D"]} />
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger">
					삭제
					<MenuShortcut keys={["mod", "shift", "Backspace"]} />
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

/** A row can say under its name what it leaves alone. */
export const WithCaption: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>
				<OverflowMenuHorizontal aria-hidden />더 보기
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>내보내기</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger" caption="한국어 원문은 그대로">
					이 번역 휴지통으로
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
					<Edit aria-hidden />
					이름 바꾸기
				</DropdownMenuItem>
				<DropdownMenuItem disabled>
					<Archive aria-hidden />
					보관<MenuShortcut>쓰는 중</MenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger" disabled>
					<TrashCan aria-hidden />
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

const SORTS = [
	"최근 수정",
	"오래전 수정",
	"최근 발행",
	"오래전 발행",
	"최근 만듦",
	"오래전 만듦",
	"제목 오름차순",
	"제목 내림차순",
];

function SubmenuDemo() {
	const [sort, setSort] = useState("최근 수정");
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>보기</DropdownMenuTrigger>
			<DropdownMenuContent className="min-w-60">
				<DropdownMenuSub defaultOpen>
					<DropdownMenuSubTrigger>
						정렬<MenuValue>{sort}</MenuValue>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
							{SORTS.slice(0, 6).map((name) => (
								<DropdownMenuRadioItem key={name} value={name}>
									{name}
								</DropdownMenuRadioItem>
							))}
							<DropdownMenuSeparator />
							{SORTS.slice(6).map((name) => (
								<DropdownMenuRadioItem key={name} value={name}>
									{name}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						열<MenuValue>4개</MenuValue>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuCheckboxItem box checked>
							분류
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem box checked>
							언어
						</DropdownMenuCheckboxItem>
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
 * opens, ← closes. The row stays selected while its level is open, and the current value inside is a ✓ (one order, a rule between the date orders
 * and the title orders). Picking one applies it and closes the whole menu. There is no third level.
 */
export const SideSubmenu: Story = { render: () => <SubmenuDemo /> };

const TAGS: [string, number][] = [
	["리액트", 38],
	["타입스크립트", 21],
	["넥스트", 17],
	["회고", 9],
	["성능", 8],
	["도구", 6],
	["디자인", 4],
];

function FilterDemo() {
	const [picked, setPicked] = useState<Set<string>>(new Set(["리액트"]));
	const [text, setText] = useState("");
	const toggle = (name: string) =>
		setPicked((current) => {
			const next = new Set(current);
			if (!next.delete(name)) next.add(name);
			return next;
		});
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<FilterButton />}>필터</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-55">
				<DropdownMenuSearch label="필터 찾기" value="" onValueChange={() => undefined} />
				{["언어", "번역", "날짜"].map((name) => (
					<DropdownMenuSub key={name}>
						<DropdownMenuSubTrigger>{name}</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuItem>{name}</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				))}
				<DropdownMenuSeparator />
				{["요약", "대표 이미지", "카테고리"].map((name) => (
					<DropdownMenuSub key={name}>
						<DropdownMenuSubTrigger>{name}</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuItem>{name}</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				))}
				<DropdownMenuSub defaultOpen>
					<DropdownMenuSubTrigger>태그</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-60">
						<DropdownMenuSearch label="태그 찾기" value={text} onValueChange={setText} />
						<DropdownMenuCheckboxItem box checked={picked.has("없음")} onCheckedChange={() => toggle("없음")}>
							없음<MenuShortcut>12</MenuShortcut>
						</DropdownMenuCheckboxItem>
						<DropdownMenuSeparator />
						<DropdownMenuScroll>
							{TAGS.filter(([name]) => name.includes(text)).map(([name, count]) => (
								<DropdownMenuCheckboxItem
									key={name}
									box
									checked={picked.has(name)}
									onCheckedChange={() => toggle(name)}
								>
									{name}
									<MenuShortcut>{count}</MenuShortcut>
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuScroll>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>시리즈</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem>시리즈</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * The filter menu of a list: a search row, then only the names of what can be filtered (the common ones, a rule, the schema's fields), each opening its
 * values at the side. Where several values can be on they are boxes with their number at the end; a long list has its own search row and scrolls inside.
 */
export const FilterTwoLevel: Story = { render: () => <FilterDemo /> };

const COLUMNS = ["분류", "언어", "상태", "날짜", "요약", "시리즈"];

function ColumnsDemo() {
	const [shown, setShown] = useState(new Set(["분류", "언어", "상태", "날짜"]));
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>보기</DropdownMenuTrigger>
			<DropdownMenuContent className="min-w-55">
				{COLUMNS.map((name) => (
					<DropdownMenuCheckboxItem
						key={name}
						box
						checked={shown.has(name)}
						onCheckedChange={(checked) =>
							setShown((current) => {
								const next = new Set(current);
								if (checked) next.add(name);
								else next.delete(name);
								return next;
							})
						}
					>
						{name}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** The columns of a list: a box to show or hide each. The title is not in the list: it is always there. Their order is set in the list's head. */
export const Columns: Story = { render: () => <ColumnsDemo /> };

/** Rows that open a second level next to ordinary rows and a red one. */
export const MixedRows: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="secondary" />}>글 작업</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<FolderMoveTo aria-hidden />
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
					<TrashCan aria-hidden />
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
