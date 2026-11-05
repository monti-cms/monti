import type { Meta, StoryObj } from "@storybook/react-vite";
import { FormField, FormFieldLabel } from "./field";
import { LockMark } from "./lock-mark";
import { Text } from "./text";

/**
 * The lock of a value that cannot be changed. It goes on that value's own row, after its label, or right after a value that can never change
 * (an identifier); never once on a section title for the whole section.
 */
const meta = { title: "Primitives/LockMark", component: LockMark, args: { label: "바꿀 수 없음" } } satisfies Meta<
	typeof LockMark
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AfterAValue: Story = {
	render: (args) => (
		<p className="font-mono text-monti-body">
			memo <LockMark {...args} />
		</p>
	),
};

/** On the row of a locked value, right after its label: never gathered on a section title. */
export const AfterALabel: Story = {
	render: (args) => (
		<div className="w-80">
			<FormField>
				<FormFieldLabel>
					미리보기 경로
					<LockMark {...args} />
				</FormFieldLabel>
				<Text mono>/preview</Text>
			</FormField>
		</div>
	),
};
