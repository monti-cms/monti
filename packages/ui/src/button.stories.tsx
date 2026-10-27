import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Search } from "lucide-react";
import { Button } from "./button";
import { Spark } from "./spark";
import { Stack } from "./stack";

/**
 * Pills. One `primary` per screen or floating surface; `secondary` for one or two common side actions; `danger` only to confirm what cannot be
 * undone. Text is centered in the pill and a leading icon pulls 2px into the padding. Switch light and dark with the toolbar.
 */
const meta = {
	title: "Controls/Button/Button",
	component: Button,
	args: { children: "새 글 쓰기" },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const VARIANTS = ["primary", "secondary", "danger", "outline-danger"] as const;

/** Every variant at both sizes, then disabled. */
export const AllVariants: Story = {
	render: () => (
		<Stack gap={16}>
			{(["md", "sm"] as const).map((size) => (
				<Stack key={size} direction="row" gap={16} align="center" wrap>
					{VARIANTS.map((variant) => (
						<Button key={variant} variant={variant} size={size}>
							{variant}
						</Button>
					))}
					<Button size={size} disabled>
						disabled
					</Button>
				</Stack>
			))}
		</Stack>
	),
};

/** A leading icon sits 2px into the left padding, so it looks centered. */
export const WithIcon: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center" wrap>
			<Button>
				<Plus aria-hidden />새 글 쓰기
			</Button>
			<Button variant="secondary">
				<Search aria-hidden />
				검색
			</Button>
			<Button size="sm">
				<Spark aria-hidden />
				적용
			</Button>
		</Stack>
	),
};

/** Working: a spinner before the label, and the button cannot be pressed again. */
export const Loading: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<Button loading>저장 중…</Button>
			<Button variant="secondary" size="sm" loading>
				불러오는 중
			</Button>
		</Stack>
	),
};

/** `width="full"` spans a stacked form or a narrow panel. */
export const FullWidth: Story = {
	render: () => (
		<Stack className="max-w-xs">
			<Button width="full">로그인</Button>
		</Stack>
	),
};
