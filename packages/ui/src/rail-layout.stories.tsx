import type { Meta, StoryObj } from "@storybook/react-vite";
import { NavLink } from "./nav-link";
import { RailLayout } from "./rail-layout";
import { TextButton } from "./text-button";

/** Links on the left and their content on the right; narrow, the content wraps under the links. */
const meta = {
	title: "Patterns/RailLayout",
	component: RailLayout,
	args: { label: "컬렉션", rail: null, children: null },
	decorators: [
		(Story) => (
			<div className="max-w-[880px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof RailLayout>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<RailLayout
			{...args}
			rail={
				<>
					<NavLink active note="post" onSelect={() => undefined}>
						게시글
					</NavLink>
					<NavLink note="memo" onSelect={() => undefined}>
						메모
					</NavLink>
					<div className="pt-monti-12 pl-[10px]">
						<TextButton quiet>+ 새 컬렉션</TextButton>
					</div>
				</>
			}
		>
			<p className="pt-monti-20 text-monti-body">컬렉션의 탭과 내용이 여기에 와요.</p>
		</RailLayout>
	),
};
