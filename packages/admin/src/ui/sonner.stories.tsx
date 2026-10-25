import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { toast } from "sonner";
import { useToolbarDark } from "../stories/screen-frame";
import { Toaster } from "./sonner";

/**
 * The corner messages a screen sends after an action ("Saved", "Couldn't save"). Every screen sends the same ones, so they are checked here once
 * instead of in each screen's failed-save state.
 */
const meta = {
	title: "Feedback/Toast",
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Toasts({ send }: { send: () => void }) {
	const dark = useToolbarDark();
	useEffect(() => {
		toast.dismiss();
		send();
	}, [send]);
	return (
		<div style={{ height: "100svh" }}>
			<Toaster
				theme={dark ? "dark" : "light"}
				richColors
				closeButton
				position="bottom-right"
				expand
				duration={Number.POSITIVE_INFINITY}
			/>
		</div>
	);
}

const kinds = () => {
	toast.info("다른 창에서 이 글을 고쳤어요");
	toast.warning("이미지 2개에 대체 텍스트가 없어요");
	toast.error("저장하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.");
	toast.success("저장했어요");
};

/** Success, information, warning and failure, stacked open as they appear in the corner. */
export const Kinds: Story = { render: () => <Toasts send={kinds} /> };

const withAction = () => {
	toast.error("3개 중 1개를 옮기지 못했어요", { action: { label: "다시 시도", onClick: () => {} } });
	toast.success("휴지통으로 옮겼어요", { description: "글 2개", action: { label: "되돌리기", onClick: () => {} } });
};

/** With a second line and an action (undo, retry). */
export const WithAction: Story = { render: () => <Toasts send={withAction} /> };

const loading = () => {
	toast.loading("내보내는 중…");
};

/** Waiting on a long action. */
export const Loading: Story = { render: () => <Toasts send={loading} /> };
