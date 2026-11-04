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
	List,
	ListItem,
} from "./index";

/** A question answered before anything else, closed only by its own buttons or Escape: what cannot be undone, or taking a published post down. */
const meta = {
	title: "Controls/Overlay/AlertDialog",
	component: AlertDialog,
} satisfies Meta<typeof AlertDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A risky question: the pill is `danger`. */
export const Danger: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>공개 중인 글을 휴지통으로 옮길까요?</AlertDialogTitle>
					<AlertDialogDescription>
						사이트에서 바로 내려가고 번역 2개도 함께 옮겨져요. 복원하면 초안으로 돌아와요.
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

/** The main button keeps things as they are; the risky way out is a red text button. */
export const LeaveUnsaved: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>저장하지 않은 변경이 있어요</AlertDialogTitle>
					<AlertDialogDescription>나가면 이 화면에서 바꾼 것이 사라져요.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel variant="danger">저장하지 않고 나가기</AlertDialogCancel>
					<AlertDialogAction>계속 편집</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
};

/** `wide` (520px), for a question that lists what it touches. */
export const Wide: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent size="wide">
				<AlertDialogHeader>
					<AlertDialogTitle>3개를 영구 삭제할까요?</AlertDialogTitle>
					<AlertDialogDescription>되돌릴 수 없어요.</AlertDialogDescription>
				</AlertDialogHeader>
				<List>
					<ListItem>봄에 쓴 첫 글 · 번역 1개</ListItem>
					<ListItem>편집기를 다시 만든 이유</ListItem>
					<ListItem>cover-2026.png · 글 1개에서 씀</ListItem>
				</List>
				<AlertDialogFooter>
					<AlertDialogCancel>취소</AlertDialogCancel>
					<AlertDialogAction variant="danger">영구 삭제</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
};
