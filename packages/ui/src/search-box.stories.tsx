import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SearchBox, SearchToggle } from "./search-box";
import { Stack } from "./stack";

/** The pill that opens in place of the page's search button. An optional picker in front chooses where to look; × clears the words. */
const meta = {
	title: "Controls/Field/SearchBox",
	component: SearchBox,
	args: { "aria-label": "검색", value: "", onValueChange: () => {} },
} satisfies Meta<typeof SearchBox>;
export default meta;
type Story = StoryObj<typeof meta>;

const TARGETS = [
	{ value: "all", label: "전체" },
	{ value: "title", label: "제목" },
	{ value: "address", label: "주소" },
	{ value: "body", label: "본문" },
] as const;

function Demo({ initial, withTargets }: { initial: string; withTargets: boolean }) {
	const [value, setValue] = useState(initial);
	const [target, setTarget] = useState<(typeof TARGETS)[number]["value"]>("all");
	return (
		<SearchBox
			aria-label="검색"
			placeholder="검색"
			value={value}
			onValueChange={setValue}
			targets={withTargets ? TARGETS : undefined}
			target={target}
			onTargetChange={setTarget}
			targetLabel="찾을 곳"
		/>
	);
}

export const Playground: Story = {
	render: () => <Demo initial="" withTargets />,
};

/** Empty, with words (the × shows), and without a picker. */
export const States: Story = {
	render: () => (
		<Stack gap={16}>
			<Demo initial="" withTargets />
			<Demo initial="-2" withTargets />
			<Demo initial="리액트" withTargets={false} />
		</Stack>
	),
};

/** The page's "Search" button: pressed, the box opens in its place; emptied and left, the button comes back. With words, the box stays. */
export const Toggle: Story = {
	render: function Render() {
		const [empty, setEmpty] = useState("");
		const [held, setHeld] = useState("리액트");
		return (
			<Stack gap={16} align="start">
				<SearchToggle label="검색" aria-label="검색" placeholder="검색" value={empty} onValueChange={setEmpty} />
				<SearchToggle label="검색" aria-label="검색" placeholder="검색" value={held} onValueChange={setHeld} />
			</Stack>
		);
	},
};

function InFolder({
	folder,
	withTargets,
	initialTarget = "all",
}: {
	folder: string;
	withTargets: boolean;
	initialTarget?: (typeof TARGETS)[number]["value"];
}) {
	const [value, setValue] = useState("리액트");
	const [scope, setScope] = useState<"here" | "all">("here");
	const [target, setTarget] = useState<(typeof TARGETS)[number]["value"]>(initialTarget);
	return (
		<SearchBox
			aria-label="검색"
			placeholder="검색"
			value={value}
			onValueChange={setValue}
			scopes={[
				{ value: "here", label: folder },
				{ value: "all", label: "모든 폴더" },
			]}
			scope={scope}
			onScopeChange={setScope}
			targets={withTargets ? TARGETS : undefined}
			target={target}
			onTargetChange={setTarget}
			targetLabel="찾을 곳"
		/>
	);
}

/**
 * Inside a folder the chip names the folder it looks in, its menu widening it to every folder: alone (the library), and with the part of an entry (the list), which follows
 * the folder once it is not "전체". A long name is cut at 160px.
 */
export const Scopes: Story = {
	render: () => (
		<Stack gap={16}>
			<InFolder folder="Blog Assets" withTargets={false} />
			<InFolder folder="시리즈 원고" withTargets />
			<InFolder folder="시리즈 원고" withTargets initialTarget="title" />
			<InFolder folder="2026년 봄 여행 사진과 메모 모음" withTargets={false} />
		</Stack>
	),
};
