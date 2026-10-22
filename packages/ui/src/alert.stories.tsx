import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Feedback/Alert",
	component: Alert,
	args: { tone: "neutral", layout: "grid" },
	render: (args) => (
		<Alert {...args}>
			<Info aria-hidden />
			<AlertTitle>임시 저장했어요</AlertTitle>
			<AlertDescription>발행하기 전까지 방문자에게는 보이지 않아요.</AlertDescription>
		</Alert>
	),
} satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const TONES = ["neutral", "accent", "danger", "warning", "success"] as const;
const LAYOUTS = ["grid", "stack", "inline", "strip"] as const;

/** Every tone in every layout. `grid` expects an icon, a title and a description; `stack` is plain text; `inline` and `strip` carry an action. */
export const AllTonesAndLayouts: Story = {
	render: () => (
		<Stack gap="section">
			{LAYOUTS.map((layout) => (
				<Stack key={layout} gap="comfortable">
					<Text variant="label" tone="muted">
						{layout}
					</Text>
					{TONES.map((tone) => (
						<Alert key={tone} tone={tone} layout={layout}>
							{layout === "grid" && <AlertCircle aria-hidden />}
							{layout === "grid" && <AlertTitle>글을 불러오지 못했어요</AlertTitle>}
							{layout === "grid" && <AlertDescription>잠시 뒤에 다시 시도해 주세요.</AlertDescription>}
							{layout === "stack" && <span>글을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.</span>}
							{(layout === "inline" || layout === "strip") && (
								<>
									<span>글을 불러오지 못했어요</span>
									<Button size="xs" variant="outline">
										다시 시도
									</Button>
								</>
							)}
						</Alert>
					))}
				</Stack>
			))}
		</Stack>
	),
};

export const TitleOnly: Story = {
	render: () => (
		<Alert tone="success">
			<CheckCircle2 aria-hidden />
			<AlertTitle>발행됨</AlertTitle>
		</Alert>
	),
};

/** The title clamps to one line; the description wraps. */
export const LongText: Story = {
	render: () => (
		<div className="max-w-sm">
			<Alert tone="warning">
				<AlertCircle aria-hidden />
				<AlertTitle>
					이 글은 아직 한국어 번역만 있고 영어와 일본어 번역은 비어 있어서 방문자에게 일부만 보여요
				</AlertTitle>
				<AlertDescription>
					번역을 채우지 않고 발행하면 영어와 일본어로 들어온 방문자는 대체 언어로 된 글을 보게 돼요. 발행하기 전에
					번역을 확인해 주세요.
				</AlertDescription>
			</Alert>
		</div>
	),
};
