import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "./alert-dialog";
import { Button } from "./button";

/**
 * The same modal as `Dialog`, for a question that has to be answered: the Cancel text button and one pill, which is the danger pill when the
 * decision is a destructive one. Escape cancels. There is one layout: no icon, no small version.
 */
const meta = {
	title: "Controls/Overlay/AlertDialog",
	component: AlertDialog,
	args: {},
	render: (args) => (
		<AlertDialog {...args}>
			<AlertDialogTrigger render={<Button variant="danger" />}>휴지통으로 이동</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>휴지통으로 옮길까요?</AlertDialogTitle>
					<AlertDialogDescription>글 2개가 사이트에서 바로 내려가요.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>취소</AlertDialogCancel>
					<AlertDialogAction variant="danger">휴지통으로</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
} satisfies Meta<typeof AlertDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = { args: { defaultOpen: true }, render: meta.render };

/** A decision that is not destructive: the pill is the ink one. */
export const Plain: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>발행을 취소할까요?</AlertDialogTitle>
					<AlertDialogDescription>글이 초안으로 돌아가요.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>그대로 두기</AlertDialogCancel>
					<AlertDialogAction>발행 취소</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
};

/** Long text wraps between words, and the actions stay one row at the bottom right. */
export const LongText: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>아주 긴 제목의 글과 그 글에 달린 댓글을 모두 휴지통으로 옮길까요?</AlertDialogTitle>
					<AlertDialogDescription>
						댓글 12개와 번역 2개도 함께 옮겨져요. 30일이 지나면 휴지통에서 자동으로 지워지고, 그 뒤에는 되돌릴 수
						없어요.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>취소</AlertDialogCancel>
					<AlertDialogAction variant="danger">휴지통으로</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
};
