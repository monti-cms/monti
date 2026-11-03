import { Add } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { NavLink, RailLayout, Section, Text, TextButton } from "./index";

/** A page part with a list of links beside it, as the collections sit beside their editor in Settings. Narrow, the content wraps under the links. */
const meta = {
	title: "Patterns/Frame/RailLayout",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Collections: Story = {
	render: () => (
		<RailLayout
			label="컬렉션"
			rail={
				<>
					<NavLink active note="posts" onSelect={() => {}}>
						게시글
					</NavLink>
					<NavLink note="notes" onSelect={() => {}}>
						노트
					</NavLink>
					<TextButton variant="quiet">
						<Add />새 컬렉션
					</TextButton>
				</>
			}
		>
			<Section title="기본" last>
				<Text variant="note">게시글 컬렉션의 설정</Text>
			</Section>
		</RailLayout>
	),
};
