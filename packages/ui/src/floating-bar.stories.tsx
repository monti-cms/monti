import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	ArrowsHorizontal,
	Edit,
	Settings,
	SettingsAdjust,
	TextAlignCenter,
	TextAlignLeft,
	TextAlignRight,
	TrashCan,
	View,
} from "./icons";
import { FloatingBar, FloatingBarButton, Separator } from "./index";

/** The small floating row of tools: 3px inside, 2px between 28px buttons, a rule between groups, the floating shadow. */
const meta = { title: "Monti/EditorTools/FloatingBar", component: FloatingBar } satisfies Meta<typeof FloatingBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Icon buttons in two groups. A tool that is on (`pressed`) keeps its background; its name is in the tooltip. */
export const Default: Story = {
	render: () => (
		<FloatingBar aria-label="이미지 도구">
			<FloatingBarButton label="왼쪽 정렬">
				<TextAlignLeft aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="가운데 정렬" pressed>
				<TextAlignCenter aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="오른쪽 정렬">
				<TextAlignRight aria-hidden />
			</FloatingBarButton>
			<Separator orientation="vertical" length="bar" />
			<FloatingBarButton label="편집">
				<Edit aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="설정">
				<Settings aria-hidden />
			</FloatingBarButton>
		</FloatingBar>
	),
};

/** A button that removes something (`tone="danger"`), and a key combination in the tooltip (`shortcut`). */
export const DangerAndShortcut: Story = {
	render: () => (
		<FloatingBar aria-label="도구">
			<FloatingBarButton label="설정" shortcut={["mod", "."]}>
				<SettingsAdjust aria-hidden />
			</FloatingBarButton>
			<Separator orientation="vertical" length="bar" />
			<FloatingBarButton label="지우기" tone="danger">
				<TrashCan aria-hidden />
			</FloatingBarButton>
		</FloatingBar>
	),
};

/** A tool that cannot be used now. */
export const Disabled: Story = {
	render: () => (
		<FloatingBar aria-label="이미지 도구">
			<FloatingBarButton label="편집" disabled>
				<Edit aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="설정">
				<Settings aria-hidden />
			</FloatingBarButton>
		</FloatingBar>
	),
};

/** A button named on itself (`named`: its icon and its name, 8px inside): a site block's labelled toggle, pressed while on. No tooltip repeats it. */
export const Named: Story = {
	render: () => (
		<FloatingBar aria-label="접기 도구">
			<FloatingBarButton label="처음부터 펼치기" named pressed>
				<View aria-hidden />
				처음부터 펼치기
			</FloatingBarButton>
			<FloatingBarButton label="고르게" named>
				<ArrowsHorizontal aria-hidden />
				고르게
			</FloatingBarButton>
		</FloatingBar>
	),
};
