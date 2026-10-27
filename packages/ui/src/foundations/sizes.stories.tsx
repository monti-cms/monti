import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "../stack";
import { Text } from "../text";
import { classOf, Group, Page, px, Spec, tokens } from "./shared";

/** Heights of controls and bars, widths of columns, panels and sheets, and icon sizes. */
const meta = { title: "Foundations/Sizes" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Heights: Story = {
	render: () => (
		<Page>
			<Group title="h-monti-* (the square ones also size-monti-*)">
				{tokens.height.tokens.map(({ name, value, usage }) => (
					<Spec key={name} name={`${classOf(name)} · ${value}`} usage={usage}>
						<div className="rounded-monti-sm bg-monti-muted" style={{ height: px(name) }} />
					</Spec>
				))}
			</Group>
		</Page>
	),
};

export const Widths: Story = {
	render: () => (
		<Page>
			<Stack gap={12}>
				<Text variant="title">w-monti-*, max-w-monti-*</Text>
				{tokens.width.tokens.map(({ name, value, usage }) => (
					<Stack key={name} gap={2}>
						<div className="h-3 rounded-monti-sm bg-monti-muted" style={{ width: px(name) }} />
						<Text variant="meta">
							{classOf(name)} · {value}
						</Text>
						<Text variant="note" tone="muted">
							{usage}
						</Text>
					</Stack>
				))}
			</Stack>
		</Page>
	),
};

export const Icons: Story = {
	render: () => (
		<Page>
			<Group title="size-monti-icon-* (glyphs; the 32px button is size-monti-icon-button)">
				{tokens.size.tokens.map(({ name, value, usage }) => (
					<Spec key={name} name={`${classOf(name)} · ${value}`} usage={usage}>
						<div className="rounded-monti-sm bg-monti-emphasis" style={{ width: px(name), height: px(name) }} />
					</Spec>
				))}
			</Group>
		</Page>
	),
};
