import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilePlus, Plus, Settings, Trash2 } from "lucide-react";
import {
	Command,
	CommandEmpty,
	CommandFooter,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "./command";
import { MENU_CARD, MenuShortcut } from "./menu-parts";

/**
 * A menu you can search: a search line on top, rows under it that scroll inside (320px at most), and an optional row for the whole list at the
 * bottom. Typing filters across groups; the keyboard never leaves the line. The card is a `PopoverContent` with `padding="menu"`.
 */
const meta = {
	title: "Menu/Command",
	component: Command,
	decorators: [
		(Story) => (
			<div className={`${MENU_CARD} w-72 p-monti-6`}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Command>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Command {...args}>
			<CommandInput placeholder="찾기" />
			<CommandList>
				<CommandEmpty>맞는 것이 없어요</CommandEmpty>
				<CommandGroup heading="글">
					<CommandItem>
						<FilePlus aria-hidden />새 글 쓰기<MenuShortcut>⌘N</MenuShortcut>
					</CommandItem>
					<CommandItem>
						<Trash2 aria-hidden />
						휴지통 비우기
					</CommandItem>
					<CommandItem disabled>
						<Trash2 aria-hidden />
						휴지통으로<MenuShortcut>쓰는 중</MenuShortcut>
					</CommandItem>
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading="설정">
					<CommandItem>
						<Settings aria-hidden />
						사이트 설정<MenuShortcut>⌘,</MenuShortcut>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</Command>
	),
};

/** Filtered to nothing. */
export const NothingFound: Story = {
	render: () => (
		<Command>
			<CommandInput placeholder="찾기" value="없는 것" />
			<CommandList>
				<CommandEmpty>맞는 것이 없어요</CommandEmpty>
			</CommandList>
		</Command>
	),
};

/** Pick one: the current value is a ✓ at the end; the row the keyboard is on has the background. */
export const PickOne: Story = {
	render: () => (
		<Command value="공개">
			<CommandList>
				<CommandItem value="공개" checked>
					공개
				</CommandItem>
				<CommandItem value="비공개">비공개</CommandItem>
			</CommandList>
		</Command>
	),
};

const TAGS = [
	"리액트",
	"타입스크립트",
	"CSS",
	"접근성",
	"디자인",
	"성능",
	"테스트",
	"배포",
	"이미지",
	"번역",
	"검색",
	"보안",
];

/** A long list scrolls inside the card, and a row for the whole list stays under it. */
export const ScrollingWithFooter: Story = {
	render: () => (
		<Command>
			<CommandInput placeholder="태그 찾기" />
			<CommandList>
				<CommandEmpty>맞는 태그가 없어요</CommandEmpty>
				{TAGS.concat(TAGS).map((tag, index) => (
					<CommandItem key={index} value={`${tag}-${index}`} checked={index === 2}>
						{tag}
					</CommandItem>
				))}
			</CommandList>
			<CommandFooter>
				<CommandItem value="새 태그 만들기">
					<Plus aria-hidden />새 태그 만들기
				</CommandItem>
			</CommandFooter>
		</Command>
	),
};
