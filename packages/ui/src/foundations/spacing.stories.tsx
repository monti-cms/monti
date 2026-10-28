import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "../stack";
import { Text } from "../text";
import { Page, px, tokens } from "./shared";

/** The spacing screens use for gaps, padding and margins (`gap-monti-8`, `px-monti-16`, `-mt-monti-4`). */
const meta = { title: "Foundations/Spacing" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Scale: Story = {
	render: () => (
		<Page>
			{tokens.spacing.tokens.map(({ name, value, usage }) => (
				<Stack key={name} direction="row" gap={24} align="center">
					<Text variant="label" mono className="w-24 shrink-0">
						monti-{name.replace("space-", "")}
					</Text>
					<div className="w-monti-48 shrink-0">
						<div className="h-4 rounded-monti-sm bg-monti-emphasis" style={{ width: px(name) }} />
					</div>
					<Text variant="caption" tone="muted">
						{value} · {usage}
					</Text>
				</Stack>
			))}
		</Page>
	),
};
