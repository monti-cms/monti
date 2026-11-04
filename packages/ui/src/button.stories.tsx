import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Add, Search } from "./icons";
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

/** Every variant at each size (lg 36, md 32, sm 28), then disabled. */
export const AllVariants: Story = {
	render: () => (
		<Stack gap={16}>
			{(["lg", "md", "sm"] as const).map((size) => (
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

/** `ghost` and `ghost-danger`: an action that stands on its own where a pill is too heavy, at every height (lg 36, md 32, sm 28, xs 24), then disabled. */
export const Ghost: Story = {
	render: () => (
		<Stack gap={16}>
			{(["lg", "md", "sm", "xs"] as const).map((size) => (
				<Stack key={size} direction="row" gap={16} align="center" wrap>
					<Button variant="ghost" size={size}>
						<Add aria-hidden />
						폴더
					</Button>
					<Button variant="ghost" size={size}>
						취소
					</Button>
					<Button variant="ghost-danger" size={size}>
						비우기
					</Button>
					<Button variant="ghost" size={size} disabled>
						disabled
					</Button>
				</Stack>
			))}
		</Stack>
	),
};

/** The smallest pill, `xs` 24px, where only that fits (a card's head, a chip row). */
export const ExtraSmall: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			{VARIANTS.map((variant) => (
				<Button key={variant} variant={variant} size="xs">
					{variant}
				</Button>
			))}
		</Stack>
	),
};

/** A leading icon sits 2px into the left padding, so it looks centered. */
export const WithIcon: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center" wrap>
			<Button>
				<Add aria-hidden />새 글 쓰기
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

/**
 * Working: a spinner comes first (in place of a leading icon, pulled 2px left like one), the button keeps its fill, and its label says what is
 * happening ("저장 중…", with a share when it is known). It cannot be pressed again and is `aria-busy`.
 */
export const Loading: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center" wrap>
			<Button loading>저장 중…</Button>
			<Button variant="secondary" loading>
				<Search aria-hidden />
				검색 중…
			</Button>
			<Button variant="secondary" size="sm" loading>
				올리는 중 64%
			</Button>
			<Button variant="danger" loading>
				지우는 중…
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
