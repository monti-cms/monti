import type { Meta, StoryObj } from "@storybook/react-vite";
import { Group, Page, px, Spec, tokens } from "./shared";

/** Corner radius, `rounded-monti-*`: sm for marks, md for rows, lg for inner boxes, xl for floating panels, full for every pill. */
const meta = { title: "Foundations/Radius" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Scale: Story = {
	render: () => (
		<Page>
			<Group title="rounded-monti-*">
				{tokens.radius.tokens.map(({ name, value, usage }) => (
					<Spec key={name} name={`rounded-monti-${name.replace("radius-", "")} · ${value}`} usage={usage}>
						<div className="h-12 border border-monti-emphasis bg-monti-muted" style={{ borderRadius: px(name) }} />
					</Spec>
				))}
			</Group>
		</Page>
	),
};
