import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "../stack";
import { Text } from "../text";
import { Page, tokens } from "./shared";

/**
 * Motion (tokens.md, 움직임): three durations and two easings. Point at a bar to see its move. Exits are a step faster than entrances, and under the
 * system's reduced-motion setting nothing moves.
 */
const meta = { title: "Foundations/Motion" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const MOVE = {
	"duration-fast": "duration-(--monti-duration-fast)",
	"duration-normal": "",
	"duration-slow": "duration-(--monti-duration-slow)",
} as const;

export const Tokens: Story = {
	render: () => (
		<Page>
			{tokens.motion.tokens.map(({ name, value, usage }) => (
				<Stack key={name} direction="row" gap={24} align="center">
					<Text variant="label" mono className="w-40 shrink-0">
						{name}
					</Text>
					<div className="group/move h-monti-control-md w-40 shrink-0 rounded-monti-full bg-monti-muted">
						<div
							className={`size-monti-control-md rounded-monti-full bg-monti-emphasis transition-transform group-hover/move:translate-x-32 ${
								name in MOVE
									? MOVE[name as keyof typeof MOVE]
									: name === "ease-exit"
										? "ease-monti-exit"
										: "ease-monti-standard"
							}`}
						/>
					</div>
					<Text variant="caption" tone="muted">
						{value} · {usage}
					</Text>
				</Stack>
			))}
		</Page>
	),
};
