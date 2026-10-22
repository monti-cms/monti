import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "./button";
import { Stack } from "./stack";

const meta = {
	title: "Controls/Button",
	component: Button,
	args: { children: "저장" },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
const SIZES = ["xs", "sm", "default", "lg"] as const;

/** Every variant at every size, then the disabled state. */
export const AllVariants: Story = {
	render: () => (
		<Stack gap="spacious">
			{VARIANTS.map((variant) => (
				<Stack key={variant} direction="row" gap="condensed" align="center">
					{SIZES.map((size) => (
						<Button key={size} variant={variant} size={size}>
							{variant} · {size}
						</Button>
					))}
					<Button variant={variant} disabled>
						disabled
					</Button>
				</Stack>
			))}
		</Stack>
	),
};

export const WithIcon: Story = {
	render: () => (
		<Stack direction="row" gap="condensed">
			<Button>
				<Plus aria-hidden />
				Post 추가
			</Button>
			<Button variant="destructive">
				<Trash2 aria-hidden />
				삭제
			</Button>
			<Button size="icon" variant="outline" aria-label="추가">
				<Plus aria-hidden />
			</Button>
		</Stack>
	),
};
