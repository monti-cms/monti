import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bold, Italic } from "lucide-react";
import { Stack } from "./stack";
import { Toggle } from "./toggle";

const meta = {
	title: "Controls/Toggle",
	component: Toggle,
	args: { "aria-label": "굵게", children: <Bold aria-hidden /> },
} satisfies Meta<typeof Toggle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const VARIANTS = ["default", "outline"] as const;
const SIZES = ["sm", "default", "lg"] as const;

/** Every variant at every size, off and on, then disabled. */
export const AllVariants: Story = {
	render: () => (
		<Stack gap={24}>
			{VARIANTS.map((variant) => (
				<Stack key={variant} direction="row" gap={8} align="center">
					{SIZES.map((size) => (
						<Stack key={size} direction="row" gap={4}>
							<Toggle variant={variant} size={size} aria-label={`${variant} ${size}`}>
								<Bold aria-hidden />
							</Toggle>
							<Toggle variant={variant} size={size} defaultPressed aria-label={`${variant} ${size} on`}>
								<Bold aria-hidden />
							</Toggle>
						</Stack>
					))}
					<Toggle variant={variant} disabled aria-label="비활성">
						<Bold aria-hidden />
					</Toggle>
					<Toggle variant={variant} disabled defaultPressed aria-label="비활성 켜짐">
						<Bold aria-hidden />
					</Toggle>
					<Toggle variant={variant} aria-invalid aria-label="오류">
						<Bold aria-hidden />
					</Toggle>
				</Stack>
			))}
		</Stack>
	),
};

export const WithText: Story = {
	render: () => (
		<Stack direction="row" gap={8}>
			<Toggle>
				<Italic aria-hidden />
				기울임
			</Toggle>
			<Toggle variant="outline" defaultPressed>
				<Italic aria-hidden />
				기울임
			</Toggle>
		</Stack>
	),
};
