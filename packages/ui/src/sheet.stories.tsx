import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { FormField, FormFieldGroup, FormFieldLabel } from "./field";
import { Input } from "./input";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "./sheet";

function Body({ title = "글 설정" }: { title?: string }) {
	return (
		<>
			<SheetHeader>
				<SheetTitle>{title}</SheetTitle>
				<SheetDescription>슬러그와 발행일을 바꿀 수 있어요.</SheetDescription>
			</SheetHeader>
			<FormFieldGroup className="px-4">
				<FormField>
					<FormFieldLabel htmlFor="slug">슬러그</FormFieldLabel>
					<Input id="slug" defaultValue="summer-trip" />
				</FormField>
			</FormFieldGroup>
			<SheetFooter>
				<Button>저장</Button>
				<SheetClose render={<Button variant="outline" />}>닫기</SheetClose>
			</SheetFooter>
		</>
	);
}

const meta = {
	title: "Overlays/Sheet",
	component: Sheet,
	args: {},
	render: (args) => (
		<Sheet {...args}>
			<SheetTrigger render={<Button variant="outline" />}>설정 열기</SheetTrigger>
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

function Side({ side }: { side: "top" | "right" | "bottom" | "left" }) {
	return (
		<Sheet defaultOpen>
			<SheetContent side={side}>
				<Body title={`side ${side}`} />
			</SheetContent>
		</Sheet>
	);
}

export const SideRight: Story = { render: () => <Side side="right" /> };
export const SideLeft: Story = { render: () => <Side side="left" /> };
export const SideTop: Story = { render: () => <Side side="top" /> };
export const SideBottom: Story = { render: () => <Side side="bottom" /> };

export const WithoutCloseButton: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent showCloseButton={false}>
				<Body />
			</SheetContent>
		</Sheet>
	),
};

/** The `resizable` slot: the app owns the width and the drag handle. The handle here is a plain strip, not draggable. */
export const Resizable: Story = {
	render: () => (
		<Sheet defaultOpen>
			<SheetContent
				resizable={{
					style: { "--panel-width": "32rem" } as React.CSSProperties,
					handle: <div aria-hidden className="absolute inset-y-0 left-0 w-1 cursor-col-resize bg-monti-muted" />,
				}}
			>
				<Body title="넓힐 수 있는 패널" />
			</SheetContent>
		</Sheet>
	),
};
