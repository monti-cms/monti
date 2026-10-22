import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pencil, Settings, Trash2 } from "lucide-react";
import { IconButton } from "./icon-button";
import { Stack } from "./stack";

const meta = {
	title: "Controls/IconButton",
	component: IconButton,
	args: { label: "편집", children: <Pencil aria-hidden /> },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;
const VARIANTS = ["ghost", "outline", "secondary", "default", "destructive"] as const;

/** Every variant at every size. */
export const AllVariants: Story = {
	render: () => (
		<Stack gap="spacious">
			{VARIANTS.map((variant) => (
				<Stack key={variant} direction="row" gap="condensed" align="center">
					{SIZES.map((size) => (
						<IconButton key={size} label={`${variant} ${size}`} variant={variant} size={size}>
							<Settings aria-hidden />
						</IconButton>
					))}
					<IconButton label="비활성" variant={variant} disabled>
						<Settings aria-hidden />
					</IconButton>
				</Stack>
			))}
		</Stack>
	),
};

/** Pressed (toggle) on and off, destructive, invalid. */
export const States: Story = {
	render: () => (
		<Stack direction="row" gap="condensed" align="center">
			<IconButton label="고정 해제" pressed={false}>
				<Pencil aria-hidden />
			</IconButton>
			<IconButton label="고정됨" pressed>
				<Pencil aria-hidden />
			</IconButton>
			<IconButton label="삭제" destructive>
				<Trash2 aria-hidden />
			</IconButton>
			<IconButton label="유효하지 않음" aria-invalid>
				<Pencil aria-hidden />
			</IconButton>
			<IconButton label="비활성" disabled>
				<Pencil aria-hidden />
			</IconButton>
		</Stack>
	),
};

/** The tooltip appears on hover; side picks where. */
export const TooltipSides: Story = {
	render: () => (
		<Stack direction="row" gap="spacious" align="center">
			{(["top", "bottom", "left", "right"] as const).map((side) => (
				<IconButton key={side} label={`툴팁 ${side}`} side={side}>
					<Pencil aria-hidden />
				</IconButton>
			))}
		</Stack>
	),
};
