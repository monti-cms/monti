import type { Meta, StoryObj } from "@storybook/react-vite";
import { FloatingBar, FormatBarRequest, FormatButton, Separator } from "./index";

/**
 * The format bar over selected text: bold · italic · underline · strike · code | superscript · subscript · link · footnote · ⋯ | "✦ 요청".
 * Each format is drawn as the letter it gives; one the selected text already has is pressed.
 */
const meta = { title: "Monti/EditorTools/FormatBar", component: FormatButton } satisfies Meta<typeof FormatButton>;
export default meta;
type Story = StoryObj<typeof meta>;

const Bar = ({ pressed = [] as string[], more = true }) => (
	<FloatingBar aria-label="서식">
		<FormatButton mark="bold" label="굵게" shortcut={["mod", "B"]} pressed={pressed.includes("bold")} />
		<FormatButton mark="italic" label="기울임" shortcut={["mod", "I"]} pressed={pressed.includes("italic")} />
		<FormatButton mark="underline" label="밑줄" shortcut={["mod", "U"]} pressed={pressed.includes("underline")} />
		<FormatButton mark="strike" label="취소선" pressed={pressed.includes("strike")} />
		<FormatButton mark="code" label="코드" shortcut={["mod", "E"]} pressed={pressed.includes("code")} />
		<Separator orientation="vertical" length="bar" />
		<FormatButton mark="superscript" label="위 첨자" pressed={pressed.includes("superscript")} />
		<FormatButton mark="subscript" label="아래 첨자" pressed={pressed.includes("subscript")} />
		<FormatButton mark="link" label="링크" shortcut={["mod", "K"]} pressed={pressed.includes("link")} />
		<FormatButton mark="footnote" label="각주" pressed={pressed.includes("footnote")} />
		{more ? <FormatButton mark="more" label="다른 서식" /> : null}
		<Separator orientation="vertical" length="bar" />
		<FormatBarRequest label="요청" />
	</FloatingBar>
);

export const Default: Story = { args: { mark: "bold", label: "굵게" }, render: () => <Bar /> };

/** The selected text is already bold and a link. */
export const Pressed: Story = {
	args: { mark: "bold", label: "굵게" },
	render: () => <Bar pressed={["bold", "link"]} />,
};

/** The site added no formats, or none fits the selection: there is no ⋯. */
export const WithoutMore: Story = { args: { mark: "bold", label: "굵게" }, render: () => <Bar more={false} /> };
