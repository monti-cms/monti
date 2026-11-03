import { Renew } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spark } from "./spark";
import { Stack } from "./stack";
import { TextButton } from "./text-button";

/**
 * The assistant's button in a field's label row: a `TextButton` in the proposal blue at the label's type. "✦ 채우기" on an empty field, "↻ 다시" once it
 * has a value, "쓰는 중…" with a ring while it works.
 */
const meta = { title: "Monti/Proposal/Fill", component: TextButton } satisfies Meta<typeof TextButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<TextButton tone="proposal" size="micro">
				<Spark />
				채우기
			</TextButton>
			<TextButton tone="proposal" size="micro">
				<Renew />
				다시
			</TextButton>
			<TextButton tone="proposal" size="micro" loading>
				쓰는 중…
			</TextButton>
			<TextButton tone="proposal" size="micro" disabled>
				<Spark />
				채우기
			</TextButton>
		</Stack>
	),
};

/** Over a text, at its own size: "✦ 번역" in the language tab row, "✦ 빈 칸 채우기" in the properties tab bar. */
export const OverText: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<TextButton tone="proposal" size="note">
				<Spark />
				번역
			</TextButton>
			<TextButton tone="proposal" size="caption">
				<Spark />빈 칸 채우기
			</TextButton>
			<TextButton tone="proposal" size="note" loading>
				번역하는 중…
			</TextButton>
		</Stack>
	),
};
