import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId, useState } from "react";
import { ko } from "react-day-picker/locale";
import { Renew, Spark } from "./icons";
import {
	Box,
	Calendar,
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	FormField,
	FormFieldDescription,
	FormFieldLabel,
	IconButton,
	Input,
	MenuField,
	Popover,
	PopoverContent,
	PopoverTrigger,
	PropertyGroup,
	PropertyPanel,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
	Text,
	Textarea,
	TextButton,
	useComboboxAnchor,
} from "./index";

/**
 * The editor's properties pane: the tab bar on top, then each property a `FormField` whose input is there from the start (a pale underline
 * at rest, the ink underline on focus). The assistant's fill button ("✦ 채우기", "↻ 다시" once there is a value) sits at the end of the label row
 * and shows only while the pointer or the keyboard is in that row; what the assistant wrote waits inside the input as `proposal`.
 */
const meta = {
	title: "Monti/Proposal/PropertyPanel",
	component: PropertyPanel,
	parameters: { layout: "fullscreen" },
	args: { label: "속성", value: "basic", onValueChange: () => {}, tabs: [] },
	decorators: [
		(Story) => (
			<Box height="screen" width="fit">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof PropertyPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

type Tab = React.ComponentProps<typeof PropertyPanel>["tabs"][number];

const TABS: Tab[] = [
	{ value: "basic", label: "기본" },
	{ value: "seo", label: "SEO" },
];

const CATEGORIES = ["여행", "기술", "일상"];
const TAGS = ["가을", "산", "사진", "걷기"];

/** The assistant's button for one field: "✦ 채우기" while empty, "↻ 다시" once there is a value, "쓰는 중…" while it works. */
function Fill({ filled = false, loading = false }: { filled?: boolean; loading?: boolean }) {
	return (
		<TextButton tone="proposal" size="micro" loading={loading}>
			{loading ? (
				"쓰는 중…"
			) : filled ? (
				<>
					<Renew aria-hidden />
					다시
				</>
			) : (
				<>
					<Spark aria-hidden />
					채우기
				</>
			)}
		</TextButton>
	);
}

function TextRow({
	label,
	value,
	placeholder = "비어 있음",
	proposal = false,
	multiline = false,
	fill,
	fromBody = false,
}: {
	label: string;
	value?: string;
	placeholder?: string;
	proposal?: boolean;
	multiline?: boolean;
	fill?: "empty" | "filled" | "loading";
	/** The field fills from the start of the body: a button at the end of its line, where the address has its regenerate button. */
	fromBody?: boolean;
}) {
	const id = useId();
	const action = fill === undefined ? undefined : <Fill filled={fill === "filled"} loading={fill === "loading"} />;
	const end = fromBody ? (
		<IconButton label="본문에서 가져오기">
			<Renew aria-hidden />
		</IconButton>
	) : undefined;
	return (
		<FormField>
			<FormFieldLabel htmlFor={id} action={action}>
				{label}
			</FormFieldLabel>
			{multiline ? (
				<Textarea id={id} size="sm" defaultValue={value} placeholder={placeholder} proposal={proposal} action={end} />
			) : (
				<Input id={id} size="sm" defaultValue={value} placeholder={placeholder} proposal={proposal} action={end} />
			)}
		</FormField>
	);
}

function AddressRow() {
	const id = useId();
	return (
		<FormField>
			<FormFieldLabel htmlFor={id}>주소</FormFieldLabel>
			<Input
				id={id}
				size="sm"
				mono
				defaultValue="autumn-trail"
				action={
					<IconButton label="제목으로 다시 만들기">
						<Renew aria-hidden />
					</IconButton>
				}
			/>
		</FormField>
	);
}

/** A field in a select's look that opens a calendar: the date can be set by hand. */
function PublishedRow() {
	const id = useId();
	return (
		<FormField>
			<FormFieldLabel htmlFor={id}>발행일</FormFieldLabel>
			<Popover>
				<PopoverTrigger render={<MenuField id={id} value="2026. 10. 24 10:12" mono />} />
				<PopoverContent width="auto" padding="none" align="start">
					<Calendar
						locale={ko}
						mode="single"
						defaultMonth={new Date(2026, 9, 24)}
						selected={new Date(2026, 9, 24)}
						showOutsideDays={false}
					/>
				</PopoverContent>
			</Popover>
		</FormField>
	);
}

function CategoryRow({
	label,
	value,
	fill,
	proposal = false,
}: {
	label: string;
	value: string | null;
	fill?: "empty" | "filled";
	proposal?: boolean;
}) {
	const id = useId();
	return (
		<FormField>
			<FormFieldLabel htmlFor={id} action={fill ? <Fill filled={fill === "filled"} /> : undefined}>
				{label}
			</FormFieldLabel>
			<Combobox items={CATEGORIES} defaultValue={value}>
				<ComboboxInput id={id} size="sm" placeholder="없음" showClear={value !== null} proposal={proposal} />
				<ComboboxContent>
					<ComboboxList>
						{(item: string) => (
							<ComboboxItem key={item} value={item}>
								{item}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</FormField>
	);
}

function TagsRow() {
	const id = useId();
	const anchor = useComboboxAnchor();
	return (
		<FormField>
			<FormFieldLabel htmlFor={id}>태그</FormFieldLabel>
			<Combobox items={TAGS} multiple defaultValue={["가을", "산"]}>
				<ComboboxChips ref={anchor} size="sm">
					<ComboboxValue>
						{(values: string[]) => values.map((tag) => <ComboboxChip key={tag}>{tag}</ComboboxChip>)}
					</ComboboxValue>
					<ComboboxChipsInput id={id} />
				</ComboboxChips>
				<ComboboxContent anchor={anchor}>
					<ComboboxList>
						{(item: string) => (
							<ComboboxItem key={item} value={item}>
								{item}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</FormField>
	);
}

function SelectRow({ proposal = false }: { proposal?: boolean }) {
	const id = useId();
	const items = [
		{ value: "short", label: "짧은 글" },
		{ value: "long", label: "긴 글" },
	];
	return (
		<FormField>
			<FormFieldLabel htmlFor={id}>분량</FormFieldLabel>
			<Select items={items} defaultValue="short">
				<SelectTrigger id={id} size="sm" width="full" proposal={proposal}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{items.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</FormField>
	);
}

function SwitchRow() {
	const id = useId();
	return (
		<FormField>
			<FormFieldLabel htmlFor={id}>검색에서 숨기기</FormFieldLabel>
			<Switch id={id} />
		</FormField>
	);
}

function Panel({
	tabs = TABS,
	initial = "basic",
	children,
}: {
	tabs?: Tab[];
	initial?: string;
	children: (tab: string) => React.ReactNode;
}) {
	const [tab, setTab] = useState(initial);
	return (
		<PropertyPanel label="속성" value={tab} onValueChange={setTab} tabs={tabs}>
			{children(tab)}
		</PropertyPanel>
	);
}

const Seo = () => (
	<PropertyGroup>
		<TextRow label="SEO 제목" placeholder="제목과 같음 · 10/60" fill="empty" />
		<TextRow label="SEO 설명" placeholder="요약과 같음 · 28/160" multiline fill="empty" />
		<SwitchRow />
	</PropertyGroup>
);

/** Every kind of property with its input from the start. Point at a row to see its "✦ 채우기". */
export const Basic: Story = {
	render: () => (
		<Panel>
			{(tab) =>
				tab === "seo" ? (
					<Seo />
				) : (
					<>
						<PropertyGroup>
							<AddressRow />
							<PublishedRow />
							<TextRow label="요약" multiline fill="empty" fromBody />
							<TextRow label="부제" value="단풍이 시작된 산길에서" fill="filled" />
						</PropertyGroup>
						<PropertyGroup title="분류">
							<CategoryRow label="카테고리" value="여행" />
							<TagsRow />
							<CategoryRow label="시리즈" value={null} fill="empty" />
							<SelectRow />
						</PropertyGroup>
					</>
				)
			}
		</Panel>
	),
};

/** The assistant's values wait inside the inputs in blue; the other tab has a proposal too (a blue dot after its name). */
export const Proposals: Story = {
	render: () => (
		<Panel tabs={[TABS[0], { ...TABS[1], dot: "proposal", dotLabel: "제안 있음" }]}>
			{(tab) =>
				tab === "seo" ? (
					<Seo />
				) : (
					<PropertyGroup>
						<TextRow label="요약" value="단풍이 시작된 산길을 하루 동안 걸은 기록" multiline proposal fill="filled" />
						<TextRow label="부제" value="가을 산길 하루" proposal fill="filled" />
						<SelectRow proposal />
						<CategoryRow label="시리즈" value="여행" fill="filled" proposal />
					</PropertyGroup>
				)
			}
		</Panel>
	),
};

/** The assistant is writing one field: a ring and "쓰는 중…", blue, not dimmed, and it stays shown. */
export const Filling: Story = {
	render: () => (
		<Panel>
			{() => (
				<PropertyGroup>
					<TextRow label="요약" multiline fill="loading" />
					<TextRow label="부제" fill="empty" />
				</PropertyGroup>
			)}
		</Panel>
	),
};

/** A value that cannot be changed here (a translation's field shared with the source): text, and one quiet line under it. */
export const ReadOnlyValue: Story = {
	render: () => (
		<Panel>
			{() => (
				<PropertyGroup>
					<FormField>
						<FormFieldLabel>대표 이미지</FormFieldLabel>
						<Text variant="note">autumn-trail.jpg</Text>
						<FormFieldDescription>원문과 함께 써요.</FormFieldDescription>
					</FormField>
					<TextRow label="요약" multiline fill="empty" />
				</PropertyGroup>
			)}
		</Panel>
	),
};

/** The SEO tab: values that follow another value say so in their placeholder. */
export const SeoTab: Story = {
	render: () => <Panel initial="seo">{(tab) => (tab === "seo" ? <Seo /> : null)}</Panel>,
};
