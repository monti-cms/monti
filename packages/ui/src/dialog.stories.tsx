import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./dialog";
import { DialogFormFooter } from "./dialog-form-footer";
import { FormField, FormFieldGroup, FormFieldLabel } from "./field";
import { Input } from "./input";
import { Stack } from "./stack";
import { TextButton } from "./text-button";

/**
 * The modal: a question or a short form that must be answered before anything else. A 20px title over an ink rule, the text 16px below, and the
 * actions at the bottom right: a Cancel text button and one pill. It has no close button; Cancel and Escape close it. Anything that grows past a few
 * fields is a sheet.
 */
const meta = {
	title: "Controls/Overlay/Dialog",
	component: Dialog,
	args: {},
	render: (args) => (
		<Dialog {...args}>
			<DialogTrigger render={<Button variant="secondary" />}>예약 발행</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>예약 발행</DialogTitle>
					<DialogDescription>정한 시간에 글이 자동으로 발행돼요.</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose render={<TextButton />}>취소</DialogClose>
					<Button>예약하기</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	),
} satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = { args: { defaultOpen: true }, render: meta.render };

/** `DialogFooter showCloseButton` adds the Cancel text button, so a caller only writes the pill. */
export const CancelFromFooter: Story = {
	render: () => (
		<Dialog defaultOpen>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>저장하지 않은 변경</DialogTitle>
					<DialogDescription>저장하지 않고 나가면 바뀐 내용이 사라져요.</DialogDescription>
				</DialogHeader>
				<DialogFooter showCloseButton>
					<Button variant="danger">저장하지 않고 나가기</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	),
};

/** `of` names what the title is about, after a dot in the regular weight: "새 언어 · tlh". */
export const TitleOf: Story = {
	render: () => (
		<Dialog defaultOpen>
			<DialogContent>
				<DialogHeader>
					<DialogTitle of="tlh">새 언어</DialogTitle>
				</DialogHeader>
				<DialogFooter showCloseButton>
					<Button>추가</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	),
};

function FormDemo({ busy = false, disabled = false }: { busy?: boolean; disabled?: boolean }) {
	const [open, setOpen] = useState(true);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<form onSubmit={(e) => e.preventDefault()}>
					<Stack gap={24}>
						<DialogHeader>
							<DialogTitle>카테고리 추가</DialogTitle>
							<DialogDescription>글을 묶는 이름을 정해 주세요.</DialogDescription>
						</DialogHeader>
						<FormFieldGroup>
							<FormField>
								<FormFieldLabel htmlFor="category">이름</FormFieldLabel>
								<Input id="category" defaultValue="일상" />
							</FormField>
						</FormFieldGroup>
						<DialogFormFooter
							onCancel={() => setOpen(false)}
							busy={busy}
							disabled={disabled}
							submitLabel="추가"
							busyLabel="추가하는 중"
						/>
					</Stack>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** A form in a dialog: focus starts in the first field, and `DialogFormFooter` writes the actions. */
export const FormFooter: Story = { render: () => <FormDemo /> };
export const FormFooterBusy: Story = { render: () => <FormDemo busy /> };
export const FormFooterDisabled: Story = { render: () => <FormDemo disabled /> };

/** A long title wraps inside the box, between words; the rule runs under all of it. */
export const LongContent: Story = {
	render: () => (
		<Dialog defaultOpen>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						아주 긴 제목의 대화상자가 좁은 화면에서 어떻게 줄바꿈되는지 확인하기 위한 제목입니다
					</DialogTitle>
					<DialogDescription>
						설명이 길어지면 여러 줄로 이어져요. 대화상자는 너비를 넘지 않고 높이만 늘어나요. 아래 버튼은 언제나 오른쪽
						아래에 한 줄로 있어요.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter showCloseButton>
					<Button>확인했어요</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	),
};

/** `size="lg"`: a form with a preview. The surface is the same; only the width differs. */
export const Large: Story = {
	render: () => (
		<Dialog open>
			<DialogContent size="lg">
				<form onSubmit={(e) => e.preventDefault()}>
					<Stack gap={24}>
						<DialogHeader>
							<DialogTitle>이미지 넣기</DialogTitle>
							<DialogDescription>파일을 고르거나 주소를 붙여 넣어요.</DialogDescription>
						</DialogHeader>
						<FormFieldGroup>
							<FormField>
								<FormFieldLabel htmlFor="image-url">주소</FormFieldLabel>
								<Input id="image-url" mono defaultValue="https://example.com/desk-morning.jpg" />
							</FormField>
							<FormField>
								<FormFieldLabel htmlFor="image-alt">대체 글</FormFieldLabel>
								<Input id="image-alt" defaultValue="아침 책상" />
							</FormField>
						</FormFieldGroup>
						<DialogFormFooter onCancel={() => {}} submitLabel="넣기" />
					</Stack>
				</form>
			</DialogContent>
		</Dialog>
	),
};
