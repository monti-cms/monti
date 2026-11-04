import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocCallout, DocCode, DocTable } from "./doc-blocks";
import { Stack } from "./stack";

const meta = { title: "Components/DocBlocks", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The blocks as a translation shows them: the source's (darker, on the tool ground) and the translation's. */
export const Blocks: Story = {
	render: () => (
		<Stack gap={16}>
			<DocCallout source>
				<p className="m-0">버전 안내</p>
				<p className="m-0">이 글은 리액트 19 기준이다.</p>
			</DocCallout>
			<DocCallout>
				<p className="m-0">About versions</p>
				<p className="m-0">This post is based on React 19.</p>
			</DocCallout>
			<DocCode>{"export default function Post({ title }) {\n  return <h1>{title}</h1>;\n}"}</DocCode>
			<DocTable
				head={["버전", "바뀐 점", "옮길 때"]}
				rows={[
					["18", "훅 도입 이후 안정", "그대로"],
					["19", "서버 컴포넌트 정식", "데이터 불러오기 정리"],
				]}
			/>
		</Stack>
	),
};
