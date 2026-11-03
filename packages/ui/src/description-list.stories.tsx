import type { Meta, StoryObj } from "@storybook/react-vite";
import { DescriptionItem, DescriptionList } from "./index";

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
