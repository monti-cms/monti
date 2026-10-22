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
import { Text } from "./text";

const meta = {
	title: "Overlays/Dialog",
	component: Dialog,
	args: {},
	render: (args) => (
		<Dialog {...args}>
			<DialogTrigger render={<Button variant="outline" />}>안내 열기</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>예약 발행</DialogTitle>
					<DialogDescription>정한 시간에 글이 자동으로 발행돼요.</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>닫기</DialogClose>
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

export const WithoutCloseButton: Story = {
	render: () => (
		<Dialog defaultOpen>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>저장하지 않은 변경</DialogTitle>
					<DialogDescription>닫으려면 아래 버튼을 눌러 주세요.</DialogDescription>
				</DialogHeader>
				<DialogFooter showCloseButton />
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
					<Stack gap="spacious">
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
							cancelLabel="취소"
						/>
					</Stack>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** DialogFormFooter: Cancel and a submit button. */
export const FormFooter: Story = { render: () => <FormDemo /> };
export const FormFooterBusy: Story = { render: () => <FormDemo busy /> };
export const FormFooterDisabled: Story = { render: () => <FormDemo disabled /> };

export const LongContent: Story = {
	render: () => (
		<Dialog defaultOpen>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						아주 긴 제목의 대화상자가 좁은 화면에서 어떻게 줄바꿈되는지 확인하기 위한 제목입니다
					</DialogTitle>
					<DialogDescription>
						설명이 길어지면 여러 줄로 이어져요. 대화상자는 최대 너비를 넘지 않고 높이만 늘어나요. 닫기 버튼이 제목과
						겹치지 않는지 봐 주세요.
					</DialogDescription>
				</DialogHeader>
				<Text tone="muted">본문 영역</Text>
			</DialogContent>
		</Dialog>
	),
};

/** A wide dialog (`size="lg"`): a form with a preview. `sm` is for a question, `xl` for a review of many changes. */
export const Large: Story = {
	render: () => (
		<Dialog open>
			<DialogContent size="lg">
				<DialogHeader>
					<DialogTitle>이미지 넣기</DialogTitle>
					<DialogDescription>파일을 고르거나 주소를 붙여 넣어요.</DialogDescription>
				</DialogHeader>
			</DialogContent>
		</Dialog>
	),
};
