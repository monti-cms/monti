import type { Meta, StoryObj } from "@storybook/react-vite";
import { BlockTitleField, SourceBox, Textarea } from "./index";

/** A site block written in its own language, in the editor (editor-tools.md, the source block). */
const meta = { title: "Monti/EditorTools/SourceBox", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const drawing = <p className="m-0 text-center font-mono text-monti-body">E = mc²</p>;

/** At rest: the drawing in its box. */
export const Resting: Story = {
	render: () => (
		<SourceBox label="원문 코드" source={null}>
			{drawing}
		</SourceBox>
	),
};

/** Picked: the source in an area of its own under the drawing. */
export const Picked: Story = {
	render: () => (
		<SourceBox
			selected
			label="원문 코드"
			source={<Textarea mono size="sm" rows={4} aria-label="원문 코드" defaultValue="E = mc^2" />}
		>
			{drawing}
		</SourceBox>
	),
};

/** Empty: the box says what to write. */
export const Empty: Story = { render: () => <SourceBox empty="수식 입력" label="원문 코드" source={null} /> };

/** A name typed in the block: no line or ground of its own. */
export const Title: Story = { render: () => <BlockTitleField aria-label="제목" placeholder="노트" /> };
