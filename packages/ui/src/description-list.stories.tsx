import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, CountRow, DescriptionItem, DescriptionList, Label, Stack, Text } from "./index";

/** Label and value rows (an event's details, a file's information): a 76px label column, quiet labels, values a step darker. */
const meta = {
	title: "Patterns/Frame/DescriptionList",
	component: DescriptionList,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Values wrap; identifiers and model names are mono. */
export const Details: Story = {
	render: () => (
		<DescriptionList>
			<DescriptionItem label="종류">글 발행</DescriptionItem>
			<DescriptionItem label="보낸 곳" mono>
				https://hooks.monti.blog/deploy
			</DescriptionItem>
			<DescriptionItem label="모델" mono>
				claude-haiku-5-5
			</DescriptionItem>
			<DescriptionItem label="때">2026. 11. 3 오후 3:12</DescriptionItem>
			<DescriptionItem label="결과">503 · 서버가 잠시 응답하지 않아 10분 뒤에 다시 보내요</DescriptionItem>
		</DescriptionList>
	),
};

/** What a backup restores (`summary`): a 120px label column, values in ink, a quiet note after a value. */
export const Summary: Story = {
	render: () => (
		<Box width="sheet">
			<DescriptionList variant="summary">
				<DescriptionItem label="글">
					148{" "}
					<Text variant="meta" tone="subtle">
						초안 12 · 발행 130 · 보관 6 · 번역 21
					</Text>
				</DescriptionItem>
				<DescriptionItem label="폴더">3</DescriptionItem>
				<DescriptionItem label="미디어">
					24{" "}
					<Text variant="meta" tone="subtle">
						파일 포함
					</Text>
				</DescriptionItem>
				<DescriptionItem label="주소">
					160{" "}
					<Text variant="meta" tone="subtle">
						이전 주소 12
					</Text>
				</DescriptionItem>
				<DescriptionItem label="템플릿">3</DescriptionItem>
			</DescriptionList>
		</Box>
	),
};

/** How many of each kind an export holds: one line per kind, the count in mono at the end. */
export const Counts: Story = {
	render: () => (
		<Box width="side-panel">
			<Stack gap={8}>
				<Label>담기는 것</Label>
				<div>
					<CountRow label="글" count={1} />
					<CountRow label="분류" count={1} />
					<CountRow label="번역" count={1} />
					<CountRow label="폴더" count={1} />
					<CountRow label="주소" count={3} />
					<CountRow label="미디어 정보(파일 제외)" count={4} />
				</div>
			</Stack>
		</Box>
	),
};
