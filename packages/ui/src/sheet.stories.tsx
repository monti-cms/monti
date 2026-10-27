import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "./button";
import { FormField, FormFieldGroup, FormFieldLabel } from "./field";
import { Input } from "./input";
import { ResizeHandle, useResizableWidth } from "./resize-handle";
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

function ResizableDemo() {
	const resize = useResizableWidth({ storageKey: "story-sheet", defaultWidth: 520, min: 400, max: 800 });
	return (
		<Sheet defaultOpen>
			<SheetContent
				resizable={{
					style: { "--panel-width": `${resize.width}px` } as React.CSSProperties,
					handle: (
						<ResizeHandle
							edge="start"
							label="시트 너비 조절"
							value={resize.width}
							min={resize.min}
							max={resize.max}
							onChange={resize.setWidth}
							onReset={resize.reset}
							resizing={resize.resizing}
						/>
					),
				}}
			>
				<Body title="넓힐 수 있는 시트" />
			</SheetContent>
		</Sheet>
	);
}

/** The app owns the width and the drag handle: drag the left edge or use the arrow keys. This one starts with the left arrow pressed once. */
export const Resizable: Story = {
	render: () => <ResizableDemo />,
	play: async () => {
		const handle = await within(document.body).findByRole("separator", { name: "시트 너비 조절" });
		// The width is remembered in the browser: start from the default each time.
		await userEvent.dblClick(handle);
		await expect(handle).toHaveAttribute("aria-valuenow", "520");
		handle.focus();
		await userEvent.keyboard("{ArrowLeft}");
		await expect(handle).toHaveAttribute("aria-valuenow", "536");
	},
};
