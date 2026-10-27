import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { Stack } from "./stack";
import { Text } from "./text";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const meta = {
	title: "Controls/ToggleGroup",
	component: ToggleGroup,
} satisfies Meta<typeof ToggleGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

function Items({ disabled }: { disabled?: boolean }) {
	return (
		<>
			<ToggleGroupItem value="left" aria-label="왼쪽 정렬" disabled={disabled}>
				<AlignLeft aria-hidden />
			</ToggleGroupItem>
			<ToggleGroupItem value="center" aria-label="가운데 정렬" disabled={disabled}>
				<AlignCenter aria-hidden />
			</ToggleGroupItem>
			<ToggleGroupItem value="right" aria-label="오른쪽 정렬" disabled={disabled}>
				<AlignRight aria-hidden />
			</ToggleGroupItem>
		</>
	);
}

export const Playground: Story = {
	render: (args) => (
		<ToggleGroup defaultValue={["left"]} {...args}>
			<Items />
		</ToggleGroup>
	),
};

/** Variants x sizes, at spacing 0 (joined) and the default spacing 2. */
export const AllVariants: Story = {
	render: () => (
		<Stack gap={24}>
			{(["default", "outline"] as const).map((variant) =>
				(["sm", "default", "lg"] as const).map((size) =>
					[0, 2].map((spacing) => (
						<Stack key={`${variant}-${size}-${spacing}`} direction="row" gap={8} align="center">
							<Text variant="caption" tone="muted">
								{variant} · {size} · spacing {spacing}
							</Text>
							<ToggleGroup variant={variant} size={size} spacing={spacing} defaultValue={["center"]}>
								<Items />
							</ToggleGroup>
						</Stack>
					)),
				),
			)}
		</Stack>
	),
};

export const Multiple: Story = {
	render: () => (
		<ToggleGroup multiple variant="outline" spacing={0} defaultValue={["left", "right"]}>
			<Items />
		</ToggleGroup>
	),
};

export const Vertical: Story = {
	render: () => (
		<Stack direction="row" gap={24}>
			<ToggleGroup orientation="vertical" variant="outline" spacing={0} defaultValue={["center"]}>
				<Items />
			</ToggleGroup>
			<ToggleGroup orientation="vertical" defaultValue={["center"]}>
				<Items />
			</ToggleGroup>
		</Stack>
	),
};

export const Disabled: Story = {
	render: () => (
		<Stack gap={8}>
			<ToggleGroup disabled defaultValue={["left"]}>
				<Items />
			</ToggleGroup>
			<ToggleGroup variant="outline" defaultValue={["left"]}>
				<Items disabled />
			</ToggleGroup>
		</Stack>
	),
};
