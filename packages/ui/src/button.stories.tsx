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

const VARIANTS = ["default", "outline", "secondary", "ghost", "quiet", "link"] as const;
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
			<Button variant="secondary" tone="danger">
				<Trash2 aria-hidden />
				삭제
			</Button>
			<Button size="icon" variant="outline" aria-label="추가">
				<Plus aria-hidden />
			</Button>
		</Stack>
	),
};

/** Every look in the danger tone: for steps that remove or overwrite. */
export const DangerTone: Story = {
	render: () => (
		<Stack direction="row" gap="condensed" align="center" wrap>
			{VARIANTS.map((variant) => (
				<Button key={variant} variant={variant} tone="danger">
					{variant}
				</Button>
			))}
		</Stack>
	),
};

/** Working: a spinner before the label, and the button cannot be pressed again. */
export const Loading: Story = {
	render: () => (
		<Stack direction="row" gap="condensed" align="center">
			<Button loading>저장 중…</Button>
			<Button variant="outline" size="sm" loading>
				불러오는 중
			</Button>
			<Button variant="secondary" tone="danger" loading>
				삭제 중
			</Button>
		</Stack>
	),
};
