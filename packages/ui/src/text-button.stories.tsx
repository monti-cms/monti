import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box } from "./box";
import { ChangeLine, ChangeLines } from "./change";
import { FormField, FormFieldLabel } from "./field";
import { Input } from "./input";
import { Spark } from "./spark";
import { Stack } from "./stack";
import { Text } from "./text";
import { TextButton } from "./text-button";

/** Words that act where a button's height does not fit: in a sentence, on a field's label row, at the end of a change line. It reads as a link. Where a button fits, use `Button variant="ghost"`. */
const meta = {
	title: "Controls/Button/TextButton",
	component: TextButton,
	args: { children: "목록에서 보기 →", variant: "underline" },
} satisfies Meta<typeof TextButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Inside a sentence it sits on the text's own baseline. */
export const InSentence: Story = {
	render: () => (
		<Box maxWidth="panel">
			<Text variant="body">
				글이 아직 저장되지 않았어요. <TextButton variant="underline">목록에서 보기 →</TextButton> 또는{" "}
				<TextButton variant="underline" mono href="#top">
					/first-post
				</TextButton>
				에서 이어서 하세요.
			</Text>
		</Box>
	),
};

/** On a field's label row: the assistant's "✦ 채우기" in the label's type (`tone="proposal"`, `size="micro"`), and a quiet underlined "되돌리기" at `caption`. */
export const OnLabelRow: Story = {
	render: () => (
		<Stack gap={24} className="max-w-sm">
			<FormField>
				<FormFieldLabel
					htmlFor="summary"
					action={
						<TextButton tone="proposal" size="micro">
							<Spark aria-hidden />
							채우기
						</TextButton>
					}
				>
					요약
				</FormFieldLabel>
				<Input id="summary" />
			</FormField>
			<Stack direction="row" gap={16} align="center">
				<TextButton variant="underline" quiet size="caption">
					되돌리기
				</TextButton>
				<TextButton tone="proposal" size="micro" loading>
					쓰는 중…
				</TextButton>
			</Stack>
		</Stack>
	),
};

/** At the end of a change line it takes the line's ink and size (`variant="inherit"`). */
export const ChangeLineEnd: Story = {
	render: () => (
		<Box maxWidth="panel">
			<ChangeLines>
				<ChangeLine
					what="이 컬렉션을 가리키는 글 4편"
					then={
						<>
							연결 끊김 · <TextButton variant="inherit">연결 끊기</TextButton>
						</>
					}
					tone="warning"
				/>
			</ChangeLines>
		</Box>
	),
};
