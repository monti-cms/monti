import type { Meta, StoryObj } from "@storybook/react-vite";
import { Add } from "./icons";
import {
	Command,
	CommandEmpty,
	CommandFooter,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	Popover,
	PopoverContent,
	PopoverTrigger,
	TextButton,
} from "./index";

/** A menu you can search, inside a `PopoverContent padding="menu"`: the search line, rows in groups, and a footer row for the whole list. */
const meta = {
	title: "Controls/Menu/Command",
	component: Command,
} satisfies Meta<typeof Command>;
export default meta;
type Story = StoryObj<typeof meta>;

const Card = ({ children }: { children: React.ReactNode }) => (
	<Popover defaultOpen>
		<PopoverTrigger render={<TextButton>태그</TextButton>} />
		<PopoverContent width="sm" padding="menu">
			{children}
		</PopoverContent>
	</Popover>
);

/** Picking a tag: the current one ticked, a "+ New tag" footer. */
export const PickOne: Story = {
	render: () => (
		<Card>
			<Command>
				<CommandInput placeholder="태그 찾기" />
				<CommandList>
					<CommandGroup heading="태그">
						<CommandItem checked>회고</CommandItem>
						<CommandItem>에디터</CommandItem>
						<CommandItem>디자인</CommandItem>
					</CommandGroup>
				</CommandList>
				<CommandFooter>
					<TextButton>
						<Add />새 태그
					</TextButton>
				</CommandFooter>
			</Command>
		</Card>
	),
};

/** Rows in groups with a rule between them, and a danger row last in its group. */
export const Groups: Story = {
	render: () => (
		<Card>
			<Command>
				<CommandInput placeholder="링크할 글 찾기" />
				<CommandList>
					<CommandGroup heading="게시글">
						<CommandItem>봄에 쓴 첫 글</CommandItem>
						<CommandItem>편집기를 다시 만든 이유</CommandItem>
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading="노트">
						<CommandItem>읽은 책 정리</CommandItem>
						<CommandItem variant="danger">링크 지우기</CommandItem>
					</CommandGroup>
				</CommandList>
			</Command>
		</Card>
	),
};

/** Nothing matches: one centered faint line. */
export const NoMatch: Story = {
	render: () => (
		<Card>
			<Command>
				<CommandInput placeholder="태그 찾기" value="여행" />
				<CommandList>
					<CommandEmpty>맞는 태그가 없어요</CommandEmpty>
					<CommandGroup heading="태그">
						<CommandItem>회고</CommandItem>
					</CommandGroup>
				</CommandList>
			</Command>
		</Card>
	),
};
