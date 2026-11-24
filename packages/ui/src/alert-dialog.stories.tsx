import type { Meta, StoryObj } from "@storybook/react-vite";
import { Document, Link } from "./icons";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogEffect,
	AlertDialogEffects,
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
						사이트에서 바로 내려가고 번역 2개도 함께 옮겨집니다. 복원하면 초안으로 돌아옵니다.
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
					<AlertDialogTitle>저장하지 않은 변경 사항이 있습니다</AlertDialogTitle>
					<AlertDialogDescription>나가면 변경 사항이 사라집니다.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel variant="danger">저장하지 않고 나가기</AlertDialogCancel>
					<AlertDialogAction>계속 편집</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
};

/** The screen can save from outside: saving and leaving is the main button, keeping on is the side one, the risky way out stays a red text button. */
export const LeaveUnsavedSave: Story = {
	tags: ["visual"],
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent size="wide">
				<AlertDialogHeader>
					<AlertDialogTitle>저장하지 않은 변경 사항이 있습니다</AlertDialogTitle>
					<AlertDialogDescription>나가면 변경 사항이 사라집니다.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel variant="danger">저장하지 않고 나가기</AlertDialogCancel>
					<AlertDialogAction variant="secondary">계속 고치기</AlertDialogAction>
					<AlertDialogAction>저장하고 나가기</AlertDialogAction>
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
					<AlertDialogDescription>되돌릴 수 없습니다.</AlertDialogDescription>
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

/** 무엇을 건드리는지 한 줄씩 적는 상자(`AlertDialogEffects`): 원문 언어 바꾸기. */
export const Effects: Story = {
	render: () => (
		<AlertDialog defaultOpen>
			<AlertDialogContent size="wide">
				<AlertDialogHeader>
					<AlertDialogTitle>원문 언어를 English로 바꿀까요?</AlertDialogTitle>
					<AlertDialogDescription>
						모든 글의 기준이 English가 됩니다. 글 내용은 지워지지 않습니다.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogEffects>
					<AlertDialogEffect icon={<Document aria-hidden />}>
						English 글이 있는 24편은 그 글이 원문이 됩니다.
					</AlertDialogEffect>
					<AlertDialogEffect icon={<Link aria-hidden />}>공개 주소 50개가 바뀝니다.</AlertDialogEffect>
				</AlertDialogEffects>
				<AlertDialogFooter>
					<AlertDialogCancel>취소</AlertDialogCancel>
					<AlertDialogAction>English를 원문으로</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	),
};
