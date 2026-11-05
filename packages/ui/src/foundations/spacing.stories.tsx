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

/** The three bands (tokens.md, 간격): pick the band by what is being spaced, then the step inside it. */
export const Bands: Story = {
	render: () => (
		<Page>
			{[
				{
					band: "inside",
					steps: [2, 4, 6, 8],
					what: "inside one part: icon and words, label and value, a chip, rows that run on (4)",
				},
				{
					band: "parts",
					steps: [10, 12, 16, 20, 24],
					what: "a part's padding and the room between parts: fields (20), a panel's or dialog's edge (24)",
				},
				{
					band: "layout",
					steps: [32, 40, 48],
					what: "areas of a screen: between sections (32), sheet sections (40), page top (40) and sides (48)",
				},
			].map(({ band, steps, what }) => (
				<Stack key={band} gap={8}>
					<Text variant="title">{band}</Text>
					<Stack direction="row" gap={8} align="end">
						{steps.map((step) => (
							<Stack key={step} gap={4} align="center">
								<div className="w-4 rounded-monti-sm bg-monti-emphasis" style={{ height: px(`space-${step}`) }} />
								<Text variant="meta">{step}</Text>
							</Stack>
						))}
					</Stack>
					<Text variant="caption" tone="muted">
						{what}
					</Text>
				</Stack>
			))}
		</Page>
	),
};
