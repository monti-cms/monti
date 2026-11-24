import type { Meta, StoryObj } from "@storybook/react-vite";
import { OverflowMenuHorizontal, View } from "./icons";
import { Button, EditorBackButton, EditorHeader, EditorPath, IconButton, Inline } from "./index";

/** The head of an editor: the way back and where the entry lives at the start, its actions at the end. */
const meta = {
	title: "Patterns/Frame/EditorHeader",
	component: EditorHeader,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof EditorHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

/** `EditorBackButton` ("‹ 글", its chevron 12px from the start) and `EditorPath` ("/ folder / title"). */
export const Default: Story = {
	render: () => (
		<EditorHeader>
			<Inline gap={8} minWidth={0}>
				<EditorBackButton>글</EditorBackButton>
				<EditorPath folders={["보기 모음"]} title="보기 모음 · 코드의 머리와 언어" />
			</Inline>
			<Inline gap={4}>
				<Button variant="ghost">
					<View aria-hidden />
					미리보기
				</Button>
				<IconButton label="더 보기" side="bottom">
					<OverflowMenuHorizontal aria-hidden />
				</IconButton>
			</Inline>
		</EditorHeader>
	),
};

/** A long title is a value: it is cut with "…" at 360px and says itself whole when pointed at. The folders are never cut. */
export const LongTitle: Story = {
	render: () => (
		<EditorHeader>
			<Inline gap={8} minWidth={0}>
				<EditorBackButton>글</EditorBackButton>
				<EditorPath
					folders={["보기 모음", "아주 깊은 폴더"]}
					title="아주 긴 글 제목은 머리 줄에서 360px에서 잘리고 가리키면 전부 보인다 · 두 번째 줄로 넘어가지 않는다"
				/>
			</Inline>
		</EditorHeader>
	),
};
