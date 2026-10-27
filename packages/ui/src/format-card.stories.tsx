import type { Meta, StoryObj } from "@storybook/react-vite";
import { FormatButton, FormatCard } from "./format-card";
import { UiLabelsProvider } from "./labels";
import { Stack } from "./stack";
import { Text } from "./text";

/**
 * The card that appears over selected text. Ten inline formats in two rows of five (the last, ⋯, opens the formats the site added), and under a
 * rule one row that asks the assistant.
 */
const meta = {
	title: "Monti/EditorTools/FormatCard",
	component: FormatCard,
	args: { requestLabel: "요청", requestShortcut: "⌘J", onRequest: () => undefined, children: null },
	// The footnote button's glyph is a word of the app's language.
	decorators: [
		(Story) => (
			<UiLabelsProvider labels={{ footnoteMark: "각¹" }}>
				<Story />
			</UiLabelsProvider>
		),
	],
} satisfies Meta<typeof FormatCard>;
export default meta;
type Story = StoryObj<typeof meta>;

function Formats({ pressed = [] }: { pressed?: readonly string[] }) {
	const on = (mark: string) => pressed.includes(mark);
	return (
		<>
			<FormatButton mark="bold" label="굵게" pressed={on("bold")} />
			<FormatButton mark="italic" label="기울임" pressed={on("italic")} />
			<FormatButton mark="underline" label="밑줄" pressed={on("underline")} />
			<FormatButton mark="strike" label="취소선" pressed={on("strike")} />
			<FormatButton mark="code" label="코드" pressed={on("code")} />
			<FormatButton mark="superscript" label="위 첨자" pressed={on("superscript")} />
			<FormatButton mark="subscript" label="아래 첨자" pressed={on("subscript")} />
			<FormatButton mark="link" label="링크" pressed={on("link")} />
			<FormatButton mark="footnote" label="각주" pressed={on("footnote")} />
			<FormatButton mark="more" label="더 보기" />
		</>
	);
}

export const Playground: Story = {
	render: (args) => (
		<FormatCard {...args}>
			<Formats />
		</FormatCard>
	),
};

/** The selected text is bold: that format is pressed. */
export const Pressed: Story = {
	render: (args) => (
		<FormatCard {...args}>
			<Formats pressed={["bold"]} />
		</FormatCard>
	),
};

/** Over the text it belongs to. */
export const OverText: Story = {
	render: (args) => (
		<Stack gap={8} className="max-w-md">
			<Text variant="reading">
				블로그를 다시 만들기로 한 건 <mark className="bg-monti-selected">도구를 고치는 시간이</mark> 길어졌기 때문이다.
			</Text>
			<FormatCard {...args}>
				<Formats pressed={["italic", "link"]} />
			</FormatCard>
		</Stack>
	),
};
