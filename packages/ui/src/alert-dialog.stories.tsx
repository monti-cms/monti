import type { Meta, StoryObj } from "@storybook/react-vite";
import { Trash2 } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "./alert-dialog";
import { Button } from "./button";

const meta = {
	title: "Overlays/AlertDialog",
	component: AlertDialog,
	args: {},
	render: (args) => (
		<AlertDialog {...args}>
			<AlertDialogTrigger render={<Button variant="destructive" />}>휴지통으로 이동</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>이 글을 휴지통으로 옮길까요?</AlertDialogTitle>
					<AlertDialogDescription>30일 안에는 휴지통에서 되돌릴 수 있어요.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>취소</AlertDialogCancel>
					<AlertDialogAction variant="destructive">이동</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
} satisfies Meta<typeof AlertDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = { args: { defaultOpen: true }, render: meta.render };

export const Small: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent size="sm">
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

export const WithMedia: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogMedia>
						<Trash2 aria-hidden />
					</AlertDialogMedia>
					<AlertDialogTitle>글을 완전히 지울까요?</AlertDialogTitle>
					<AlertDialogDescription>지운 글은 되돌릴 수 없어요.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>취소</AlertDialogCancel>
					<AlertDialogAction variant="destructive">완전히 삭제</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
};

export const SmallWithMedia: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogMedia>
						<Trash2 aria-hidden />
					</AlertDialogMedia>
					<AlertDialogTitle>글을 지울까요?</AlertDialogTitle>
					<AlertDialogDescription>되돌릴 수 없어요.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>취소</AlertDialogCancel>
					<AlertDialogAction variant="destructive">삭제</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
};

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
					<AlertDialogAction variant="destructive">이동</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
};
