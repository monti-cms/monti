import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar, ListBoxes, TextShortParagraph } from "./icons";
import {
	Button,
	FormField,
	FormFieldLabel,
	Input,
	LockMark,
	PickList,
	PickListItem,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSection,
	SheetSplit,
	SheetTitle,
	TextButton,
} from "./index";

/** Where work with several inputs happens: 520px from the right over a dimmed page, a 60px head, Cancel and one pill at the bottom. */
const meta = {
	title: "Controls/Overlay/Sheet",
	component: Sheet,
	parameters: { bleed: true },
} satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

const Footer = (
	<SheetFooter>
		<TextButton>취소</TextButton>
		<Button>추가</Button>
	</SheetFooter>
);

/** Titled sections in the body; a section that cannot be changed ends its title with a lock. */
export const Sections: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<SheetHeader>
					<SheetTitle of="노트" ofMono={false}>
						필드 추가
					</SheetTitle>
				</SheetHeader>
				<SheetBody>
					<SheetSection title="보기">
						<FormField>
							<FormFieldLabel htmlFor="label">라벨</FormFieldLabel>
							<Input id="label" defaultValue="읽는 시간" />
						</FormField>
					</SheetSection>
					<SheetSection
						title={
							<>
								구조 <LockMark label="구조는 바꿀 수 없어요" />
							</>
						}
					>
						<FormField>
							<FormFieldLabel htmlFor="name">이름</FormFieldLabel>
							<Input id="name" defaultValue="readingTime" />
						</FormField>
					</SheetSection>
				</SheetBody>
				{Footer}
			</SheetContent>
		</Sheet>
	),
};

/** A body split in two: the kinds on the left, the picked kind's settings on the right. */
export const Split: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>필드 추가</SheetTitle>
				</SheetHeader>
				<SheetSplit
					list={
						<PickList aria-label="필드 종류">
							<PickListItem selected>
								<TextShortParagraph />
								텍스트
							</PickListItem>
							<PickListItem>
								<ListBoxes />
								선택
							</PickListItem>
							<PickListItem>
								<Calendar />
								날짜
							</PickListItem>
						</PickList>
					}
				>
					<SheetBody>
						<FormField>
							<FormFieldLabel htmlFor="split-label">라벨</FormFieldLabel>
							<Input id="split-label" />
						</FormField>
					</SheetBody>
				</SheetSplit>
				{Footer}
			</SheetContent>
		</Sheet>
	),
};

/** Busy: no close button, so the sheet cannot be left; the title names what it is about in mono. */
export const Busy: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<SheetHeader closable={false}>
					<SheetTitle of="posts-2026.csv">가져오기</SheetTitle>
				</SheetHeader>
				<SheetBody>
					<FormField>
						<FormFieldLabel htmlFor="busy">컬렉션</FormFieldLabel>
						<Input id="busy" defaultValue="게시글" disabled />
					</FormField>
				</SheetBody>
				<SheetFooter>
					<Button loading>가져오는 중…</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	),
};
