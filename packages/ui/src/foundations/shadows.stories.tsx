import type { Meta, StoryObj } from "@storybook/react-vite";
import { classOf, Group, Page, px, Spec, tokens } from "./shared";

/** The three shadows: floating menus and bubbles, dialogs, sheets. Resting surfaces are flat, with a border only. */
const meta = { title: "Foundations/Shadows" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Floating: Story = {
	render: () => (
		<Page>
			<Group title="shadow-monti-*">
				{tokens.shadow.tokens.map(({ name, usage }) => (
					<Spec key={name} name={classOf(name)} usage={usage}>
						<div
							className="h-16 rounded-monti-lg border border-monti-emphasis bg-monti-page"
							style={{ boxShadow: px(name) }}
						/>
					</Spec>
				))}
			</Group>
		</Page>
	),
};
