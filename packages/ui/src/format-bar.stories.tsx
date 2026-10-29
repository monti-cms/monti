import type { Meta, StoryObj } from "@storybook/react-vite";
import { FormatBar, FormatBarRequest, FormatBarSeparator, FormatButton } from "./format-bar";
import { UiLabelsProvider } from "./labels";
import { Highlight } from "./proposal-marks";
import { Text } from "./text";

/**
 * The bar that floats above selected text, in one row: the inline formats (bold, italic, underline, strike, code), then super- and subscript, link,
 * footnote and ⋯ (the formats the site added), and at the end the request to the assistant, "✦ 요청 ⌘J". Hover a button for its name.
 */
const meta = {
	title: "Monti/EditorTools/FormatBar",
	component: FormatBar,
	// The footnote button's glyph is a word of the app's language.
	decorators: [
		(Story) => (
			<UiLabelsProvider labels={{ footnoteMark: "각¹" }}>
				<Story />
			</UiLabelsProvider>
		),
	],
} satisfies Meta<typeof FormatBar>;
export default meta;
type Story = StoryObj<typeof meta>;

function Formats({ pressed = [] }: { pressed?: readonly string[] }) {
	const on = (mark: string) => pressed.includes(mark);
	return (
		<>
			<FormatButton mark="bold" label="굵게" shortcut={["mod", "B"]} pressed={on("bold")} />
			<FormatButton mark="italic" label="기울임" shortcut={["mod", "I"]} pressed={on("italic")} />
			<FormatButton mark="underline" label="밑줄" shortcut={["mod", "U"]} pressed={on("underline")} />
			<FormatButton mark="strike" label="취소선" pressed={on("strike")} />
			<FormatButton mark="code" label="코드" pressed={on("code")} />
			<FormatBarSeparator />
			<FormatButton mark="superscript" label="위 첨자" pressed={on("superscript")} />
			<FormatButton mark="subscript" label="아래 첨자" pressed={on("subscript")} />
			<FormatButton mark="link" label="링크" shortcut={["mod", "K"]} pressed={on("link")} />
			<FormatButton mark="footnote" label="각주" pressed={on("footnote")} />
			<FormatButton mark="more" label="사이트가 더한 서식" />
			<FormatBarSeparator />
			<FormatBarRequest label="요청" />
		</>
	);
}

export const Playground: Story = {
	render: (args) => (
		<FormatBar aria-label="꾸미기" {...args}>
			<Formats />
		</FormatBar>
	),
};

/** The selected text is italic and a link: those formats are pressed. */
export const Pressed: Story = {
	render: (args) => (
		<FormatBar aria-label="꾸미기" {...args}>
			<Formats pressed={["italic", "link"]} />
		</FormatBar>
	),
};

/** Over the text it belongs to: the bar floats above the selected words. */
export const OverText: Story = {
	render: (args) => (
		<div className="relative max-w-md pt-14">
			<FormatBar aria-label="꾸미기" className="absolute top-0 left-24" {...args}>
				<Formats pressed={["italic"]} />
			</FormatBar>
			<Text variant="reading">
				블로그를 다시 만들기로 한 건 <Highlight>도구를 고치는 시간이</Highlight> 길어졌기 때문이다.
			</Text>
		</div>
	),
};
