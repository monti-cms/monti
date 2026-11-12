import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
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

/** Pointed at, the lock says why in a tooltip: the same words a screen reader hears as its name (2026-11-12, decided while building). */
export const PointedAt: Story = {
	args: { label: "운영 사이트에서는 잠김" },
	render: (args) => (
		<div className="w-80 pt-monti-32">
			<FormField>
				<FormFieldLabel>
					공개 주소
					<LockMark {...args} />
				</FormFieldLabel>
				<Text mono>/posts/:slug</Text>
			</FormField>
		</div>
	),
	play: async ({ canvasElement }) => {
		await userEvent.hover(await within(canvasElement).findByRole("img", { name: "운영 사이트에서는 잠김" }));
		await within(document.body).findByRole("tooltip");
	},
};
