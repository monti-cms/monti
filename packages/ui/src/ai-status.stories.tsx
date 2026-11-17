import type { Meta, StoryObj } from "@storybook/react-vite";
import { AiFailed, AiWorking, Box, FormField, FormFieldLabel, Inline, Input, Separator, Stack, Text } from "./index";

const noop = () => {};

/**
 * AI work where it is asked, the same on every task (a fill, a request at a place, a translation): "생성 중 · 멈추기" while it runs, with no
 * seconds counted, and one red line with "다시 시도" when it did not go.
 */
const meta = {
	title: "Monti/Assistant/AiStatus",
	component: AiWorking,
} satisfies Meta<typeof AiWorking>;
export default meta;
type Story = StoryObj<typeof meta>;

/** At work, with the way to stop it. */
export const Working: Story = { args: { onStop: noop } };

/** At work where it cannot be stopped: the ring and the words. */
export const WorkingAlone: Story = {};

/** On a field's label row, in the label's type: it takes the place of "✦ 채우기" and stays shown while the pointer is elsewhere. */
export const OnLabelRow: Story = {
	render: () => (
		<Box maxWidth="panel">
			<Stack gap={24}>
				<FormField>
					<FormFieldLabel htmlFor="subtitle" action={<AiWorking size="caption" onStop={noop} />}>
						부제
					</FormFieldLabel>
					<Input id="subtitle" />
				</FormField>
				<FormField>
					<FormFieldLabel htmlFor="tags">태그</FormFieldLabel>
					<Input id="tags" />
					<AiFailed onRetry={noop}>응답 시간 초과</AiFailed>
				</FormField>
			</Stack>
		</Box>
	),
};

/** Did not go: why in a few words, and the same work asked again. */
export const Failed: Story = {
	render: () => <AiFailed onRetry={noop}>OpenRouter 응답 없음</AiFailed>,
};

/** Did not go, and asking again cannot help (no key): the reason alone. */
export const FailedNoRetry: Story = {
	render: () => <AiFailed>OpenRouter 키 없음</AiFailed>,
};

/** Stopped at its limit: the line's button lets it go on. */
export const AtLimit: Story = {
	render: () => (
		<AiFailed onRetry={noop} retryLabel="이어서 하기">
			한도에 닿아 멈췄습니다
		</AiFailed>
	),
};

/** Beside "✦ 번역" over a translation: at work, then failed, in the place of the button. */
export const BesideTranslate: Story = {
	render: () => (
		<Stack gap={16}>
			<Inline gap={12}>
				<AiWorking onStop={noop} />
				<Separator orientation="vertical" length="control" />
				<Text variant="note" tone="subtle">
					원문 보기
				</Text>
			</Inline>
			<Inline gap={12}>
				<AiFailed onRetry={noop}>연결이 끊겼습니다</AiFailed>
				<Separator orientation="vertical" length="control" />
				<Text variant="note" tone="subtle">
					원문 보기
				</Text>
			</Inline>
		</Stack>
	),
};
