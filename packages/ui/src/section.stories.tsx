import type { Meta, StoryObj } from "@storybook/react-vite";
import { FormField, FormFieldLabel } from "./field";
import { Input } from "./input";
import { Section } from "./section";

/**
 * A section of a settings screen: the title in a column on the left, the fields beside it, a hairline under. On a narrow screen the fields wrap
 * under the title.
 */
const meta = {
	title: "Primitives/Section",
	component: Section,
	args: { title: "사이트", children: null },
	decorators: [
		(Story) => (
			<div className="max-w-[880px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Section>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Section {...args}>
			<FormField>
				<FormFieldLabel htmlFor="site-name">사이트 이름</FormFieldLabel>
				<Input id="site-name" defaultValue="example.dev" />
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="site-url">주소</FormFieldLabel>
				<Input id="site-url" defaultValue="https://example.dev" className="font-mono" />
			</FormField>
		</Section>
	),
};

/** Sections one under another; the last one (`last`) has no hairline under it. */
export const Stacked: Story = {
	render: () => (
		<>
			<Section title="사이트">
				<FormField>
					<FormFieldLabel htmlFor="name">사이트 이름</FormFieldLabel>
					<Input id="name" defaultValue="example.dev" />
				</FormField>
			</Section>
			<Section title="언어" last>
				<FormField>
					<FormFieldLabel htmlFor="lang">기본 언어</FormFieldLabel>
					<Input id="lang" defaultValue="ko" className="font-mono" />
				</FormField>
			</Section>
		</>
	),
};

/** `stacked`: the title over its fields, for a section in a narrow column (the basics of a collection). */
export const StackedTitle: Story = {
	render: () => (
		<div className="max-w-[560px]">
			<Section title="보기" stacked>
				<FormField>
					<FormFieldLabel htmlFor="label">표시 이름</FormFieldLabel>
					<Input id="label" defaultValue="게시글" />
				</FormField>
			</Section>
			<Section title="구조" stacked last>
				<FormField>
					<FormFieldLabel htmlFor="path">공개 주소</FormFieldLabel>
					<Input id="path" defaultValue="/posts/:slug" className="font-mono" />
				</FormField>
			</Section>
		</div>
	),
};
