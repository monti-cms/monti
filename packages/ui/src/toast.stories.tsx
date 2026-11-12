import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { ProposalBubble, ProposalBubbleDock, Stack, Toaster, toast } from "./index";

/** The result of an action, one pill at the bottom center: one message, at most one action. A failure is the same pill on the danger ground. */
const meta = {
	title: "Controls/Status/Toast",
	component: Toaster,
	parameters: { bleed: true },
} satisfies Meta<typeof Toaster>;
export default meta;
type Story = StoryObj<typeof meta>;

const Show = ({ fire }: { fire: () => void }) => {
	useEffect(() => {
		fire();
		return () => {
			toast.dismiss();
		};
	}, [fire]);
	return <Toaster duration={Number.POSITIVE_INFINITY} />;
};

/** Two at once, one over the other: both can be read. */
export const Stacked: Story = {
	render: () => (
		<Show
			fire={() => {
				toast.error("setup.exe · 지원하지 않는 형식");
				toast.error("panorama.png · 10 MB 초과");
			}}
		/>
	),
};

/** A message with one action. */
export const Undo: Story = {
	render: () => (
		<Show fire={() => toast("휴지통으로 옮겼어요", { action: { label: "되돌리기", onClick: () => {} } })} />
	),
};

/** A message alone. */
export const Message: Story = {
	render: () => <Show fire={() => toast("저장했습니다")} />,
};

/** A failure. */
export const Failure: Story = {
	render: () => (
		<Show fire={() => toast.error("저장하지 못했어요", { action: { label: "다시", onClick: () => {} } })} />
	),
};

/** The hint while files are dragged over a folder, the folder's name in bold. */
export const DropHint: Story = {
	render: () => (
		<Show
			fire={() =>
				toast.dropHint(
					<>
						<b>covers</b>에 놓아요
					</>,
				)
			}
		/>
	),
};

/**
 * With the proposal bubble docked at the bottom centre: the toast stands 12px above it, so the bubble's buttons can be pressed. When the bubble
 * goes the toast comes back down to 32px over the window's edge.
 */
export const OverTheBubble: Story = {
	render: () => (
		<Stack height="screen" gap={0}>
			<Show fire={() => toast("저장했습니다")} />
			<ProposalBubbleDock>
				<ProposalBubble
					name="독일어도 추가해 줘"
					position={1}
					total={2}
					previousLabel="이전 제안"
					nextLabel="다음 제안"
					onPrevious={() => {}}
					onNext={() => {}}
					discardAllLabel="모두 버리기"
					onDiscardAll={() => {}}
					acceptAllLabel="모두 받기"
					onAcceptAll={() => {}}
				/>
			</ProposalBubbleDock>
		</Stack>
	),
};
