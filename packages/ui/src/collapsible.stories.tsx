import type { Meta, StoryObj } from "@storybook/react-vite";
import { Caret } from "./caret";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { Stack } from "./stack";
import { Text } from "./text";
import { TextButton } from "./text-button";

function Example(props: { defaultOpen?: boolean; disabled?: boolean }) {
	return (
		<Collapsible {...props}>
			<CollapsibleTrigger render={<TextButton variant="quiet" />}>
				고급 설정
				<Caret />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<Text as="p" tone="muted" className="pt-monti-8">
					캐시 시간과 예약 발행 같은 드물게 쓰는 항목이에요.
				</Text>
			</CollapsibleContent>
		</Collapsible>
	);
}

/** A trigger and the content it opens. The trigger is a text button with the design system's caret after its text. */
const meta = {
	title: "Patterns/List/Collapsible",
	component: Collapsible,
	decorators: [
		(Story) => (
			<Stack className="max-w-sm">
				<Story />
			</Stack>
		),
	],
	render: () => <Example defaultOpen />,
} satisfies Meta<typeof Collapsible>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Closed, open, and disabled (dimmed). */
export const States: Story = {
	render: () => (
		<Stack gap={24}>
			<Example />
			<Example defaultOpen />
			<Example disabled />
		</Stack>
	),
};
