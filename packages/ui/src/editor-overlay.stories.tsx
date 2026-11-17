import type { Meta, StoryObj } from "@storybook/react-vite";
import { DropLine, EditorMarginLine, HeldBlock, Marker } from "./index";

/** A block in hand while it is dragged, and the line where it would land. */
const meta = {
	title: "Monti/EditorTools/HeldBlock",
	component: HeldBlock,
	parameters: { layout: "padded" },
	args: { kind: "제목 2", text: "서론" },
} satisfies Meta<typeof HeldBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A heading in hand: its kind and its text. */
export const Heading: Story = {
	render: (args) => (
		<div className="max-w-monti-reading">
			<HeldBlock {...args} />
		</div>
	),
};

/** A long item is cut at the card's 280px; the drop line starts with its ring. */
export const ListItemAndLine: Story = {
	args: { kind: "목록 항목", text: "두 번째 요점은 길어서 카드 끝에서 잘린다, 280px을 넘지 않게" },
	render: (args) => (
		<div className="flex max-w-monti-reading flex-col gap-monti-24">
			<HeldBlock {...args} />
			<DropLine />
		</div>
	),
};

/** The title's line, with what the source's change to it says hung in the left margin, on the line of a block's marks. */
export const TitleMargin: Story = {
	render: () => (
		<div className="max-w-monti-reading pl-monti-64">
			<EditorMarginLine
				margin={
					<Marker tone="changed" onClick={() => {}}>
						변경
					</Marker>
				}
			>
				<h1 className="text-monti-display">The first post</h1>
			</EditorMarginLine>
		</div>
	),
};
