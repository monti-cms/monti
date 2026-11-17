import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar, ListBoxes, TextShortParagraph } from "./icons";
import {
	Button,
	FormField,
	FormFieldLabel,
	Input,
	Option,
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
	Stack,
	Switch,
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
		<Button variant="ghost">취소</Button>
		<Button>추가</Button>
	</SheetFooter>
);

/**
 * What the field is (untitled, first), then titled sections, 40px apart: the body spaces its parts, a section keeps no room of its own. The rows of a
 * section stand at the medium control height (32px), 4px apart.
 */
export const Sections: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent>
				<SheetHeader>
					<SheetTitle of="· 노트" ofMono={false}>
						필드 추가
					</SheetTitle>
				</SheetHeader>
				<SheetBody>
					<Stack gap={20}>
						<FormField>
							<FormFieldLabel htmlFor="name">식별자</FormFieldLabel>
							<Input id="name" mono defaultValue="readingTime" />
						</FormField>
						<FormField>
							<FormFieldLabel htmlFor="label">라벨</FormFieldLabel>
							<Input id="label" defaultValue="읽는 시간" />
						</FormField>
					</Stack>
					<SheetSection title="입력 규칙">
						<Stack gap={4}>
							<Option spread>
								필수
								<Switch />
							</Option>
							<Option spread>
								여러 줄
								<Switch defaultChecked />
							</Option>
						</Stack>
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
