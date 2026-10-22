import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, Image as ImageGlyph, Table2, Type } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Grid } from "./grid";
import { Image } from "./image";
import { Stack } from "./stack";
import { Text } from "./text";
import { ChoiceCard, Tile } from "./tile";

/** An inline SVG, so the stories load nothing from the network. */
const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#8fb8de"/><circle cx="240" cy="50" r="24" fill="#f6d365"/><path d="M0 180V120l80-50 70 60 60-40 110 70v20z" fill="#4c7a5a"/></svg>',
)}`;

const meta = {
	title: "Layout/Tile",
	component: Tile,
	args: {
		preview: <Image src={SAMPLE} alt="" ratio="photo" radius="none" />,
		title: "여름 바다.png",
		detail: "1.2MB · 2026-09-18",
		selected: false,
		dimmed: false,
	},
	decorators: [
		(Story) => (
			<div className="w-48">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Tile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const preview = <Image src={SAMPLE} alt="" ratio="photo" radius="none" />;

function Labelled({ name, children }: { name: string; children: ReactNode }) {
	return (
		<Stack gap="tight">
			<Text variant="label" tone="muted">
				{name}
			</Text>
			<div className="w-48">{children}</div>
		</Stack>
	);
}

export const Selected: Story = {
	render: () => (
		<Stack direction="row" gap="spacious" align="start">
			{[false, true].map((selected) => (
				<Labelled key={String(selected)} name={`selected ${selected}`}>
					<Tile preview={preview} title="여름 바다.png" detail="1.2MB" selected={selected} />
				</Labelled>
			))}
		</Stack>
	),
};

export const Dimmed: Story = {
	render: () => (
		<Stack direction="row" gap="spacious" align="start">
			{[false, true].map((dimmed) => (
				<Labelled key={String(dimmed)} name={`dimmed ${dimmed}`}>
					<Tile preview={preview} title="여름 바다.png" detail="1.2MB" dimmed={dimmed} />
				</Labelled>
			))}
		</Stack>
	),
};

export const Detail: Story = {
	render: () => (
		<Stack direction="row" gap="spacious" align="start">
			<Labelled name="detail 있음">
				<Tile preview={preview} title="여름 바다.png" detail="1.2MB" />
			</Labelled>
			<Labelled name="detail 없음">
				<Tile preview={preview} title="여름 바다.png" />
			</Labelled>
			<Labelled name="긴 제목은 말줄임">
				<Tile preview={preview} title="아주아주아주 긴 파일 이름의 여름 바다 사진.png" detail="1.2MB" />
			</Labelled>
		</Stack>
	),
};

/** `badge` sits top left; `action` top right and appears on hover, focus and when selected. */
export const Slots: Story = {
	render: () => (
		<Stack direction="row" gap="spacious" align="start">
			<Labelled name="badge">
				<Tile preview={preview} title="여름 바다.png" badge={<Badge variant="success">사용 중</Badge>} />
			</Labelled>
			<Labelled name="action (포인터를 올려 보세요)">
				<Tile
					preview={preview}
					title="여름 바다.png"
					action={
						<Button size="xs" variant="secondary">
							삭제
						</Button>
					}
				/>
			</Labelled>
			<Labelled name="action, selected">
				<Tile
					preview={preview}
					title="여름 바다.png"
					selected
					action={
						<Button size="xs" variant="secondary">
							삭제
						</Button>
					}
				/>
			</Labelled>
			<Labelled name="badge + action">
				<Tile
					preview={preview}
					title="여름 바다.png"
					badge={<Badge>새 파일</Badge>}
					action={
						<Button size="xs" variant="secondary">
							삭제
						</Button>
					}
				/>
			</Labelled>
		</Stack>
	),
};

/** Without an image: a fallback icon in the preview. */
export const WithoutImage: Story = {
	render: () => (
		<Labelled name="preview 대체">
			<Tile
				preview={<Image src={null} alt="" fallback={FileText} ratio="photo" radius="none" />}
				title="문서.pdf"
				detail="340KB"
			/>
		</Labelled>
	),
};

export const InGrid: Story = {
	decorators: [],
	render: () => {
		const [picked, setPicked] = useState<number | null>(1);
		return (
			<Grid columns="tiles">
				{["여름 바다", "가을 산", "겨울 숲", "봄 정원"].map((name, index) => (
					<Tile
						key={name}
						preview={preview}
						title={`${name}.png`}
						detail="1.2MB"
						selected={picked === index}
						onClick={() => setPicked(index)}
					/>
				))}
			</Grid>
		);
	},
};

const KINDS = [
	{ icon: <Type aria-hidden />, title: "텍스트", hint: "짧은 글자 한 줄" },
	{ icon: <ImageGlyph aria-hidden />, title: "이미지", hint: "사진이나 그림 한 장" },
	{ icon: <Table2 aria-hidden />, title: "표", hint: "행과 열로 된 값" },
];

export const ChoiceCards: Story = {
	render: () => {
		const [picked, setPicked] = useState(0);
		return (
			<Stack gap="condensed" className="max-w-sm">
				{KINDS.map((kind, index) => (
					<ChoiceCard
						key={kind.title}
						icon={kind.icon}
						title={kind.title}
						hint={kind.hint}
						selected={picked === index}
						onClick={() => setPicked(index)}
					/>
				))}
			</Stack>
		);
	},
};

export const ChoiceCardOptions: Story = {
	render: () => (
		<Stack gap="spacious" className="max-w-sm">
			<Stack gap="tight">
				<Text variant="label" tone="muted">
					selected false
				</Text>
				<ChoiceCard icon={<Type aria-hidden />} title="텍스트" hint="짧은 글자 한 줄" />
			</Stack>
			<Stack gap="tight">
				<Text variant="label" tone="muted">
					selected true
				</Text>
				<ChoiceCard icon={<Type aria-hidden />} title="텍스트" hint="짧은 글자 한 줄" selected />
			</Stack>
			<Stack gap="tight">
				<Text variant="label" tone="muted">
					disabled
				</Text>
				<ChoiceCard icon={<Type aria-hidden />} title="텍스트" hint="지금은 고를 수 없어요" disabled />
			</Stack>
			<Stack gap="tight">
				<Text variant="label" tone="muted">
					icon 없음, hint 없음
				</Text>
				<ChoiceCard title="텍스트" />
			</Stack>
		</Stack>
	),
};
