import type { Meta, StoryObj } from "@storybook/react-vite";
import { Suggest, SuggestLabel, SuggestList } from "./suggest";

/** A request to start from, in the assistant's empty panel: a saved one (spark) or one asked before (clock). */
const meta = {
	title: "Monti/Assistant/Suggest",
	component: Suggest,
	args: { kind: "request", children: "요약 써 줘" },
} satisfies Meta<typeof Suggest>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	decorators: [
		(Story) => (
			<div className="w-[340px]">
				<Story />
			</div>
		),
	],
};

/** The empty panel: the requests of this screen and the recent ones, under their group names, at the bottom of the panel. */
export const Groups: Story = {
	decorators: [
		(Story) => (
			<div className="flex h-[360px] w-[380px] flex-col bg-monti-tool">
				<Story />
			</div>
		),
	],
	render: () => (
		<SuggestList>
			<SuggestLabel>이 목록에서</SuggestLabel>
			<Suggest kind="request">요약이 비어 있는 글 찾아 줘</Suggest>
			<Suggest kind="request">한 달 넘게 안 고친 초안 찾아 줘</Suggest>
			<SuggestLabel>최근</SuggestLabel>
			<Suggest kind="recent">쓰지 않는 태그 정리해 줘</Suggest>
			<Suggest kind="recent">이 글 영어로 옮겨 줘</Suggest>
		</SuggestList>
	),
};
