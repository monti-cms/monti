import { ArrowDown, ArrowUp, Close } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DragHandle, IconButton, OrderedRow, Stack, Text } from "./index";

/** One item of an ordered list a writer arranges (the posts of a series): a quiet box with a handle, the item, and move up · down · take out. */
const meta = {
	title: "Patterns/List/OrderedRow",
	component: OrderedRow,
} satisfies Meta<typeof OrderedRow>;
export default meta;
type Story = StoryObj<typeof meta>;

const actions = (
	<>
		<IconButton label="위로">
			<ArrowUp />
		</IconButton>
		<IconButton label="아래로">
			<ArrowDown />
		</IconButton>
		<IconButton label="빼기">
			<Close />
		</IconButton>
	</>
);

/** Rows; an unpublished post says so after its title in the warning ink. The row in hand floats above the others. */
export const Series: Story = {
	render: () => (
		<Stack as="ol" gap={4} width="panel">
			<OrderedRow handle={<DragHandle aria-label="끌어서 옮기기" />} actions={actions}>
				1. 편집기를 다시 만든 이유
			</OrderedRow>
			<OrderedRow
				handle={<DragHandle aria-label="끌어서 옮기기" />}
				actions={actions}
				drag={{ transform: "translate3d(0, 4px, 0)", active: true }}
			>
				2. 블록 하나씩 만들기
			</OrderedRow>
			<OrderedRow handle={<DragHandle aria-label="끌어서 옮기기" />} actions={actions}>
				3. 번역 흐름{" "}
				<Text variant="caption" tone="warning">
					발행 안 됨
				</Text>
			</OrderedRow>
		</Stack>
	),
};
