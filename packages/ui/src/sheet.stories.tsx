import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { FormField, FormFieldGroup, FormFieldLabel } from "./field";
import { Input } from "./input";
import {
	Sheet,
	SheetBody,
	SheetClose,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "./sheet";
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
