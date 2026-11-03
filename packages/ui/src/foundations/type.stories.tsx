import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "../stack";
import { Text } from "../text";
import { Page, tokens } from "./shared";

/** Type roles: size, line height, weight, letter spacing and family in one class, `text-monti-<role>`. */
const meta = { title: "Foundations/Type" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Roles: Story = {
	render: () => (
		<Page>
			{tokens.type.groups.flatMap((group) =>
				group.styles.map((style) => {
					const role = style.name.replace("text-", "");
					return (
						<Stack key={role} direction="row" gap={24} align="baseline">
							<Stack gap={0} className="w-48 shrink-0">
								<Text variant="label" mono>
									text-monti-{role}
								</Text>
								<Text variant="caption" tone="muted">
									{style.fontSize} / {style.lineHeight} · {style.fontWeight} · {group.family}
								</Text>
							</Stack>
							<Stack gap={2}>
								<Text variant={role as "body"}>{style.sample}</Text>
								<Text variant="note" tone="muted">
									{style.usage}
								</Text>
							</Stack>
						</Stack>
					);
				}),
			)}
		</Page>
	),
};
