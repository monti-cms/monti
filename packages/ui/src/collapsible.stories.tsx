import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronsUpDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { IconButton } from "./icon-button";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Controls/Collapsible",
	component: Collapsible,
	decorators: [
		(Story) => (
			<Stack className="max-w-sm">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof Collapsible>;
export default meta;
type Story = StoryObj<typeof meta>;

function Example(props: { defaultOpen?: boolean; disabled?: boolean }) {
	return (
		<Collapsible {...props}>
			<Stack direction="row" align="center" justify="between">
				<Text variant="label">고급 설정</Text>
				<IconButton label="펼치기" trigger={(button) => <CollapsibleTrigger render={button} />}>
					<ChevronsUpDown aria-hidden />
				</IconButton>
			</Stack>
			<CollapsibleContent>
				<Text tone="muted">캐시 시간과 예약 발행 같은 드물게 쓰는 항목이에요.</Text>
			</CollapsibleContent>
		</Collapsible>
	);
}

export const Playground: Story = {};

export const States: Story = {
	render: () => (
		<Stack gap={24}>
			<Example />
			<Example defaultOpen />
			<Example disabled />
		</Stack>
	),
};
