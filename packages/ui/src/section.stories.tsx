import type { Meta, StoryObj } from "@storybook/react-vite";
import { FormField, FormFieldLabel } from "./field";
import { Input } from "./input";
import { Section } from "./section";

/**
 * A section of a settings screen: the title in a column on the left, the fields beside it, a hairline under. On a narrow screen the fields wrap
 * under the title.
 */
const meta = {
	title: "Layout/Section",
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

/** Sections one under another. */
export const Stacked: Story = {
	render: () => (
		<>
			<Section title="사이트">
				<FormField>
					<FormFieldLabel htmlFor="name">사이트 이름</FormFieldLabel>
					<Input id="name" defaultValue="example.dev" />
				</FormField>
			</Section>
			<Section title="언어">
				<FormField>
					<FormFieldLabel htmlFor="lang">기본 언어</FormFieldLabel>
					<Input id="lang" defaultValue="ko" className="font-mono" />
				</FormField>
			</Section>
		</>
	),
};
