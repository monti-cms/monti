import { Renew } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FormField, FormFieldLabel } from "./field";
import { Input } from "./input";
import { PropertyGroup, PropertyPanel } from "./property-list";
import { Spark } from "./spark";
import { Switch } from "./switch";
import { Text } from "./text";
import { TextButton } from "./text-button";
import { Textarea } from "./textarea";

/**
 * The editor's properties pane: a tab bar at the top (no head, no close button) and the properties, each a `FormField ruled` whose input is there from the
 * start. The assistant's fill action sits at the right end of the label row and shows while the pointer or keyboard is in the row. A value the assistant
 * wrote, or proposed, is blue in its input until it is edited.
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

const fill = (
	<TextButton tone="proposal" size="micro">
		<Spark />
		채우기
	</TextButton>
);

/** One property: its label (with the label row's action) over its input. */
function Row({
	id,
	label,
	action,
	children,
}: {
	id: string;
	label: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<FormField ruled>
			<FormFieldLabel htmlFor={id} action={action}>
				{label}
			</FormFieldLabel>
			{children}
		</FormField>
	);
}

export const Base: Story = {
	tags: ["visual"],
	render: (args) => (
		<PropertyPanel {...args} tabs={tabs}>
			<PropertyGroup>
				<Row id="slug" label="주소">
					<Input id="slug" size="sm" mono defaultValue="/first-post" />
				</Row>
				<FormField ruled>
					<FormFieldLabel>발행일</FormFieldLabel>
					<Text variant="meta">2026. 10. 01</Text>
				</FormField>
				<Row id="summary" label="요약" action={fill}>
					<Textarea id="summary" size="sm" rows={1} placeholder="비어 있음" />
				</Row>
			</PropertyGroup>
			<PropertyGroup title="분류">
				<Row id="category" label="카테고리">
					<Input id="category" size="sm" defaultValue="개발" />
				</Row>
				<Row id="tags" label="태그">
					<Input id="tags" size="sm" defaultValue="리액트, 프론트엔드" />
				</Row>
				<Row id="series" label="시리즈">
					<Input id="series" size="sm" placeholder="없음" />
				</Row>
			</PropertyGroup>
		</PropertyPanel>
	),
};

/** Writing the summary: the count stands at the end of the label row while the field has the focus. */
export const Editing: Story = {
	tags: ["visual"],
	render: (args) => (
		<PropertyPanel {...args} tabs={tabs}>
			<PropertyGroup>
				<Row
					id="summary"
					label="요약"
					action={
						<Text variant="micro" tone="subtle">
							28 / 120
						</Text>
					}
				>
					<Textarea
						id="summary"
						size="sm"
						rows={2}
						defaultValue="리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것."
						autoFocus
					/>
				</Row>
			</PropertyGroup>
		</PropertyPanel>
	),
};

/** The assistant filled the series: blue in its input, with "↻ 다시" on the label row. Editing it, or saving, returns it to the ink. */
export const FilledByAssistant: Story = {
	tags: ["visual"],
	render: function Render(args) {
		const [value, setValue] = useState("리액트 다시 만들기");
		const [proposal, setProposal] = useState(true);
		return (
			<PropertyPanel {...args} tabs={tabs}>
				<PropertyGroup title="분류">
					<Row
						id="series"
						label="시리즈"
						action={
							<TextButton tone="proposal" size="micro">
								<Renew />
								다시
							</TextButton>
						}
					>
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
					</Row>
				</PropertyGroup>
			</PropertyPanel>
		);
	},
};

/** While the request runs: the ring and "쓰는 중…", visible without the pointer. */
export const Writing: Story = {
	render: (args) => (
		<PropertyPanel {...args} tabs={tabs}>
			<PropertyGroup>
				<Row
					id="summary"
					label="요약"
					action={
						<TextButton tone="proposal" size="micro" loading>
							쓰는 중…
						</TextButton>
					}
				>
					<Textarea id="summary" size="sm" rows={1} placeholder="비어 있음" />
				</Row>
			</PropertyGroup>
		</PropertyPanel>
	),
};

/** The SEO tab: an empty value says in its placeholder what it follows. */
export const Seo: Story = {
	tags: ["visual"],
	args: { value: "SEO" },
	render: (args) => (
		<PropertyPanel {...args} tabs={tabs}>
			<PropertyGroup>
				<Row id="seo-title" label="SEO 제목">
					<Input id="seo-title" size="sm" placeholder="제목과 같음 · 10/60" />
				</Row>
				<Row id="seo-description" label="SEO 설명">
					<Textarea id="seo-description" size="sm" rows={1} placeholder="요약과 같음" />
				</Row>
				<FormField ruled>
					<FormFieldLabel htmlFor="noindex">검색에서 숨기기</FormFieldLabel>
					<Switch id="noindex" />
				</FormField>
			</PropertyGroup>
		</PropertyPanel>
	),
};
