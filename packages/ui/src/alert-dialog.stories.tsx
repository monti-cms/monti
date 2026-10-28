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
import { ChangeGroup, ChangeLine, ChangeLines, ChangeNote } from "./change";
import { TextButton } from "./text-button";

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

/** A question about leaving: the risky way out is the danger text button, and the pill keeps things as they are. */
export const Leave: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>저장하지 않은 바뀐 곳이 있어요</AlertDialogTitle>
					<AlertDialogDescription>나가면 바뀐 곳 2개가 사라져요.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel variant="danger">저장하지 않고 나가기</AlertDialogCancel>
					<AlertDialogAction>계속 고치기</AlertDialogAction>
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

/** `wide` makes room for a review that lists what the question touches, a choice on each line; the pill stays off until nothing blocks it. */
export const WithChanges: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent size="wide">
				<AlertDialogHeader>
					<AlertDialogTitle>임시를 영구 삭제할까요?</AlertDialogTitle>
					<ChangeGroup kind="drop" tag="지움" title="임시" identifier="태그">
						<ChangeLines>
							<ChangeLine
								what="가리키는 글 4편 · 첫 번째 글 외 3편"
								tone="warning"
								then={<TextButton variant="inherit">연결 끊기</TextButton>}
							/>
							<ChangeLine
								what="휴지통의 글 1편 · 연습장"
								tone="warning"
								then={<TextButton variant="inherit">같이 삭제</TextButton>}
							/>
						</ChangeLines>
						<ChangeNote>연결 끊기는 글을 남기고 태그 칸에서 임시만 빼요.</ChangeNote>
					</ChangeGroup>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>취소</AlertDialogCancel>
					<AlertDialogAction variant="danger" disabled>
						영구 삭제
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
};
