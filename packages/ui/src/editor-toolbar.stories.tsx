import type { Meta, StoryObj } from "@storybook/react-vite";
import { Code, Link, ListBulleted, Redo, TextBold, TextItalic, Undo } from "./icons";
import { Caret, EditorToolbar, EditorToolbarGroup, EditorToolbarSeparator, FloatingBarButton, Text } from "./index";

/** The editor's docked toolbar: a 40px row under the head, its first icon on the text column's start line (12px from the edge when there is no room). */
const meta = {
	title: "Monti/EditorTools/EditorToolbar",
	component: EditorToolbar,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof EditorToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Groups of 28px buttons split by short rules. Bold is on (the cursor is in bold words); redo and link cannot be used here. */
export const Default: Story = {
	render: () => (
		<EditorToolbar aria-label="서식">
			<EditorToolbarGroup>
				<FloatingBarButton label="되돌리기" shortcut={["mod", "Z"]}>
					<Undo aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="다시 하기" shortcut={["mod", "shift", "Z"]} disabled>
					<Redo aria-hidden />
				</FloatingBarButton>
			</EditorToolbarGroup>
			<EditorToolbarSeparator />
			<FloatingBarButton named label="글자 종류">
				<Text variant="caption">본문</Text>
				<Caret />
			</FloatingBarButton>
			<EditorToolbarSeparator />
			<EditorToolbarGroup>
				<FloatingBarButton label="굵게" shortcut={["mod", "B"]} pressed>
					<TextBold aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="기울임" shortcut={["mod", "I"]}>
					<TextItalic aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="코드">
					<Code aria-hidden />
				</FloatingBarButton>
			</EditorToolbarGroup>
			<EditorToolbarSeparator />
			<FloatingBarButton label="링크" disabled>
				<Link aria-hidden />
			</FloatingBarButton>
			<EditorToolbarSeparator />
			<FloatingBarButton label="글머리 목록">
				<ListBulleted aria-hidden />
			</FloatingBarButton>
		</EditorToolbar>
	),
};
