import type { Meta, StoryObj } from "@storybook/react-vite";
import { LockMark } from "./lock-mark";
import { Section } from "./section";

/**
 * The lock of a value or a section that cannot be changed. It goes once after the title of a section that is entirely structure, or right after a value
 * that can never change (an identifier).
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

export const AfterASectionTitle: Story = {
	render: (args) => (
		<div className="max-w-[880px]">
			<Section
				title={
					<>
						구조
						<LockMark {...args} />
					</>
				}
				last
			>
				<p className="font-mono text-monti-body">memo</p>
			</Section>
		</div>
	),
};
