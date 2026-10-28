import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { ChangeGroup, ChangeNote } from "./change";
import { FormField, FormFieldGroup, FormFieldLabel } from "./field";
import { Input } from "./input";
import { LockMark } from "./lock-mark";
import { PickList, PickListItem } from "./pick-list";
import {
	Sheet,
	SheetBody,
	SheetClose,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSection,
	SheetSplit,
	SheetTitle,
	SheetTrigger,
} from "./sheet";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { TextButton } from "./text-button";

function Fields({ count = 2 }: { count?: number }) {
	const fields = [
		{ id: "label", label: "표시 이름", value: "시리즈", mono: false },
		{ id: "name", label: "이름", value: "series", mono: true },
		{ id: "slug", label: "주소", value: "/series/:slug", mono: true },
		{ id: "note", label: "설명", value: "연재하는 글을 묶어요", mono: false },
		{ id: "order", label: "순서", value: "1", mono: true },
		{ id: "group", label: "묶음", value: "글", mono: false },
		{ id: "icon", label: "아이콘", value: "book", mono: true },
		{ id: "help", label: "도움말", value: "목록 맨 위에 보여요", mono: false },
	];
	return (
		<FormFieldGroup>
			{fields.slice(0, count).map((field) => (
				<FormField key={field.id}>
					<FormFieldLabel htmlFor={field.id}>{field.label}</FormFieldLabel>
					<Input id={field.id} mono={field.mono} defaultValue={field.value} />
				</FormField>
			))}
		</FormFieldGroup>
	);
}

function Body({ title = "필드 추가", count }: { title?: string; count?: number }) {
	return (
		<>
			<SheetHeader>
				<SheetTitle>{title}</SheetTitle>
			</SheetHeader>
			<SheetBody>
				<Fields count={count} />
			</SheetBody>
			<SheetFooter>
				<SheetClose render={<TextButton />}>취소</SheetClose>
				<Button>필드 추가</Button>
			</SheetFooter>
		</>
	);
}

/**
 * The sheet: where work with several inputs happens (add a field, review a save). It opens from the right over a dimmed page, 520px wide, with a
 * 60px head (the title and a close button), the work, and Cancel with one pill at the bottom right. There is no other side.
 */
const meta = {
	title: "Patterns/Sheet/Sheet",
	component: Sheet,
	args: {},
	render: (args) => (
		<Sheet {...args}>
			<SheetTrigger render={<Button variant="secondary" />}>필드 추가</SheetTrigger>
			<SheetContent>
				<Body />
			</SheetContent>
		</Sheet>
	),
} satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = { args: { defaultOpen: true }, render: meta.render };

/** A body longer than the sheet scrolls between the head and the foot, which stay where they are. */
export const LongBody: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<Body count={8} />
			</SheetContent>
		</Sheet>
	),
};

/** What the sheet is about, when the title alone does not say: the file name after it, in mono and quiet. */
export const Of: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<SheetHeader>
					<SheetTitle of="blog-export.zip">가져오기</SheetTitle>
				</SheetHeader>
				<SheetBody>
					<Fields count={3} />
				</SheetBody>
				<SheetFooter>
					<SheetClose render={<TextButton />}>취소</SheetClose>
					<Button>21편 가져오기</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	),
};

/** While the sheet is busy it cannot be left: no close button, and the pill says what is happening. */
export const Busy: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<SheetHeader closable={false}>
					<SheetTitle of="blog-export.zip">가져오기</SheetTitle>
				</SheetHeader>
				<SheetBody>
					<Fields count={3} />
				</SheetBody>
				<SheetFooter>
					<Button loading>가져오는 중</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	),
};

/** A body split in two: a list of kinds on the left and the settings of the picked one on the right, under their own tabs (add a field). */
export const Split: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<SheetHeader>
					<SheetTitle of="· 노트">필드 추가</SheetTitle>
				</SheetHeader>
				<SheetSplit
					list={
						<PickList aria-label="종류">
							<PickListItem selected>글자</PickListItem>
							<PickListItem>고르기</PickListItem>
							<PickListItem>미디어</PickListItem>
							<PickListItem mark="→">관계</PickListItem>
						</PickList>
					}
				>
					<Tabs defaultValue="basic" render={<div className="flex min-h-0 grow flex-col" />}>
						<TabsList variant="bar" inset="panel">
							<TabsTrigger value="basic">기본</TabsTrigger>
							<TabsTrigger value="advanced">고급</TabsTrigger>
						</TabsList>
						<SheetBody>
							<Fields count={3} />
						</SheetBody>
					</Tabs>
				</SheetSplit>
				<SheetFooter>
					<SheetClose render={<TextButton />}>취소</SheetClose>
					<Button>필드 추가</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	),
};

/** The editor of a field in sheet: titled sections one under another, a lock after the title of a section that cannot be changed. */
export const Sections: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<SheetHeader>
					<SheetTitle of="· 노트">요약</SheetTitle>
				</SheetHeader>
				<SheetBody>
					<SheetSection title="보기">
						<Fields count={2} />
					</SheetSection>
					<SheetSection
						title={
							<>
								구조
								<LockMark label="바꿀 수 없음" />
							</>
						}
					>
						<Fields count={2} />
					</SheetSection>
				</SheetBody>
				<SheetFooter>
					<SheetClose render={<TextButton />}>취소</SheetClose>
					<Button>저장</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	),
};

/** The quiet part of the title is plain text for a name and a count (`ofMono={false}`); it stays mono for a file name. */
export const TitleOf: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<SheetHeader>
					<SheetTitle of="· 게시글 · 바뀐 곳 3" ofMono={false}>
						검토
					</SheetTitle>
				</SheetHeader>
				<SheetBody>
					<Fields count={2} />
				</SheetBody>
				<SheetFooter>
					<SheetClose render={<TextButton />}>취소</SheetClose>
					<Button>적용</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	),
};

/** A body of change blocks (`blocks`): the first block brings its own 16px, so only 4px of the body's 20 stay above it. */
export const Blocks: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<SheetHeader>
					<SheetTitle of="· 게시글 · 바뀐 곳 1" ofMono={false}>
						검토
					</SheetTitle>
				</SheetHeader>
				<SheetBody blocks>
					<ChangeGroup kind="edit" tag="주소" title="공개 주소" identifier="게시글">
						<ChangeNote>옛 주소는 404가 돼요.</ChangeNote>
					</ChangeGroup>
				</SheetBody>
				<SheetFooter>
					<SheetClose render={<TextButton />}>취소</SheetClose>
					<Button>적용</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	),
};
