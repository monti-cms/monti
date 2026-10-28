import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AiAction } from "./ai-action";
import { Input } from "./input";
import { PropertyGroup, PropertyPanel, PropertyRow } from "./property-list";
import { Textarea } from "./textarea";

/**
 * The editor's properties pane: a tab bar at the top (no head, no close button) and a read list. Each row is a label above its value; pressing the value opens
 * the field in place. The assistant's fill action sits at the right end of the label row and shows while the pointer or keyboard is in the row. A value the
 * assistant wrote is blue until it is edited.
 */
const meta = {
	title: "Patterns/List/PropertyPanel",
	component: PropertyPanel,
	args: { label: "속성", value: "기본", onValueChange: () => undefined, tabs: [], children: null },
	parameters: { layout: "fullscreen", bleed: true },
	decorators: [
		(Story) => (
			<div className="flex h-svh justify-end">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof PropertyPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const tabs = [
	{ value: "기본", label: "기본" },
	{ value: "SEO", label: "SEO" },
];

export const Base: Story = {
	tags: ["visual"],
	render: (args) => (
		<PropertyPanel {...args} tabs={tabs}>
			<PropertyGroup>
				<PropertyRow label="주소" value="/first-post" onEdit={() => undefined} />
				<PropertyRow label="발행일" value="2026. 10. 01" onEdit={() => undefined} />
				<PropertyRow
					label="요약"
					action={<AiAction aria-label="요약 채우기" />}
					value="비어 있음"
					empty
					onEdit={() => undefined}
				/>
			</PropertyGroup>
			<PropertyGroup title="분류">
				<PropertyRow label="카테고리" value="개발" onEdit={() => undefined} />
				<PropertyRow label="태그" value="리액트 · 프론트엔드" onEdit={() => undefined} />
				<PropertyRow label="시리즈" value="없음" empty onEdit={() => undefined} />
			</PropertyGroup>
		</PropertyPanel>
	),
};

/** The summary is open in place: the count takes the action's place and the field is the underline field. */
export const Editing: Story = {
	tags: ["visual"],
	render: (args) => (
		<PropertyPanel {...args} tabs={tabs}>
			<PropertyGroup>
				<PropertyRow label="주소" value="/first-post" onEdit={() => undefined} />
				<PropertyRow
					label="요약"
					controlId="summary"
					action={<span className="text-monti-micro text-monti-subtle">28 / 120</span>}
					editing
				>
					<Textarea id="summary" size="sm" rows={2} defaultValue="리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것." />
				</PropertyRow>
			</PropertyGroup>
		</PropertyPanel>
	),
};

/** The assistant filled the series: blue, with "↻ 다시" on the label row. Editing it, or saving, returns it to the ink. */
export const FilledByAssistant: Story = {
	tags: ["visual"],
	render: (args) => (
		<PropertyPanel {...args} tabs={tabs}>
			<PropertyGroup title="분류">
				<PropertyRow label="카테고리" value="개발" onEdit={() => undefined} />
				<PropertyRow
					label="시리즈"
					action={<AiAction filled aria-label="시리즈 다시 채우기" />}
					value="리액트 다시 만들기"
					proposal
					onEdit={() => undefined}
				/>
			</PropertyGroup>
		</PropertyPanel>
	),
};

/** While the request runs: the spinner and "쓰는 중…", visible without the pointer. */
export const Writing: Story = {
	render: (args) => (
		<PropertyPanel {...args} tabs={tabs}>
			<PropertyGroup>
				<PropertyRow
					label="요약"
					action={<AiAction loading aria-label="요약 채우는 중" />}
					value="비어 있음"
					empty
					onEdit={() => undefined}
				/>
			</PropertyGroup>
		</PropertyPanel>
	),
};

/** The assistant's value opened in place: the underline is blue until the first change. */
export const FilledAndOpen: Story = {
	render: function Render(args) {
		const [value, setValue] = useState("리액트 다시 만들기");
		const [proposal, setProposal] = useState(true);
		return (
			<PropertyPanel {...args} tabs={tabs}>
				<PropertyGroup>
					<PropertyRow label="시리즈" controlId="series" editing>
						<Input
							id="series"
							size="sm"
							value={value}
							proposal={proposal}
							onChange={(event) => {
								setProposal(false);
								setValue(event.target.value);
							}}
						/>
					</PropertyRow>
				</PropertyGroup>
			</PropertyPanel>
		);
	},
};

/** The SEO tab: a read list; an empty value says what it follows. */
export const Seo: Story = {
	tags: ["visual"],
	args: { value: "SEO" },
	render: (args) => (
		<PropertyPanel {...args} tabs={tabs}>
			<PropertyGroup>
				<PropertyRow label="SEO 제목" value="제목과 같음 · 10/60" empty onEdit={() => undefined} />
				<PropertyRow label="SEO 설명" value="요약과 같음" empty onEdit={() => undefined} />
				<PropertyRow label="공유 이미지" value="대표 이미지와 같음" empty onEdit={() => undefined} />
				<PropertyRow label="검색에서 숨기기" value="아니요" onEdit={() => undefined} />
			</PropertyGroup>
		</PropertyPanel>
	),
};
