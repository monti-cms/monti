import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { Toaster, toast } from "./toast";

/**
 * One look for every message that appears at the bottom of the window: an ink pill with the message and, at most, one text button ("되돌리기" undo,
 * "보기" view, "열기" open). No status icons and no colored variants: an error is the same pill, only its words differ. Toasts stay up here so they
 * can be looked at; in the admin they close after four seconds. Switch light and dark with the toolbar.
 */
const meta = {
	title: "Overlays/Toast",
	component: Toaster,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Toaster>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Opens the toast the story sends, and closes it when the story goes. `send` must not change between renders. */
function Open({ send }: { send: () => void }) {
	useEffect(() => {
		toast.dismiss();
		send();
		return () => void toast.dismiss();
	}, [send]);
	return (
		<div style={{ height: "100svh" }}>
			<Toaster duration={Number.POSITIVE_INFINITY} />
		</div>
	);
}

const plain = () => void toast("저장했어요");
const withAction = () => void toast("휴지통으로 옮겼어요", { action: { label: "되돌리기", onClick: () => {} } });
const dropHint = () =>
	void toast.dropHint(
		<>
			사진 폴더에 <b>여행 사진</b>을 놓으세요
		</>,
	);
const longMessage = () =>
	void toast(
		"3개 중 1개를 옮기지 못했어요\n고양이 사진.png — 같은 이름의 파일이 이미 있어요. 이름을 바꾸고 다시 시도해 주세요.",
		{ action: { label: "보기", onClick: () => {} } },
	);

/** A message alone. */
export const Plain: Story = { render: () => <Open send={plain} /> };

/** A message with its one action. */
export const WithAction: Story = { render: () => <Open send={withAction} /> };

/** Shown while files are dragged over a folder: an icon and a sentence with the folder's name in bold. */
export const DropHint: Story = { render: () => <Open send={dropHint} /> };

/** A message that wraps: the pill grows in height, and the action stays on the first line's side. */
export const LongMessage: Story = { render: () => <Open send={longMessage} /> };

export const PlainDark: Story = { globals: { theme: "dark" }, render: () => <Open send={plain} /> };
export const WithActionDark: Story = { globals: { theme: "dark" }, render: () => <Open send={withAction} /> };
export const DropHintDark: Story = { globals: { theme: "dark" }, render: () => <Open send={dropHint} /> };
export const LongMessageDark: Story = { globals: { theme: "dark" }, render: () => <Open send={longMessage} /> };
