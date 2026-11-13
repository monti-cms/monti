import { Document, Link, Unlink } from "../../icons";
import {
	Box,
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	FloatingBar,
	FormatButton,
	MenuShortcut,
	MenuValue,
	Popover,
	PopoverContent,
	PopoverTrigger,
	RequestAnchor,
	Separator,
	Text,
} from "../../index";
import { BodyBlock, BodyHeading, EditorPage, EntryHeader, EntryTitle, Paragraph } from "./editor-notion";

/** What the link card shows: just opened, a search typed, an address typed, or opened on words that already link to an entry. */
export type LinkCardState = "open" | "search" | "address" | "linked";

const ENTRIES = [
	{ title: "리액트 다시 만들기 1편 · 상태", collection: "게시글" },
	{ title: "리액트 다시 만들기 2편 · 렌더링", collection: "게시글" },
	{ title: "리액트 다시 만들기 3편 · 훅", collection: "게시글 · 초안" },
	{ title: "리액트 공부 메모", collection: "메모" },
];

const RECENT = [
	{ title: "첫 번째 글", collection: "게시글" },
	{ title: "편집기를 다시 만든 이유", collection: "게시글" },
	{ title: "리액트 다시 만들기 1편 · 상태", collection: "게시글" },
	{ title: "읽을 것", collection: "메모" },
];

function EntryRow({ title, collection, checked }: { title: string; collection: string; checked?: boolean }) {
	return (
		<CommandItem value={title} checked={checked}>
			<Document aria-hidden />
			<Text truncate>{title}</Text>
			<MenuValue>{collection}</MenuValue>
		</CommandItem>
	);
}

/**
 * The link card in one field, as Notion's: what is typed decides the link. An address (`https://`, `/`, `mailto:`) links out; any other words find
 * entries of this site, and picking one links to the entry itself (`monti:entry/<group id>`), so the link holds when its address changes.
 */
function LinkCard({ state }: { state: LinkCardState }) {
	const value =
		state === "search"
			? "리액트"
			: state === "address"
				? "https://react.dev/learn"
				: state === "linked"
					? "리액트 다시 만들기 1편 · 상태"
					: "";
	return (
		<Command shouldFilter={false}>
			<CommandInput value={value} readOnly placeholder="주소를 붙여 넣거나 글 찾기" aria-label="링크" />
			<CommandList aria-label="링크할 곳">
				{state === "open" ? (
					<CommandGroup heading="최근에 고친 글">
						{RECENT.map((entry) => (
							<EntryRow key={entry.title} {...entry} />
						))}
					</CommandGroup>
				) : null}
				{state === "search" ? (
					<CommandGroup heading="글">
						{ENTRIES.map((entry) => (
							<EntryRow key={entry.title} {...entry} />
						))}
					</CommandGroup>
				) : null}
				{state === "address" ? (
					<CommandGroup heading="주소">
						<CommandItem value="address">
							<Link aria-hidden />
							<Text truncate>react.dev/learn</Text>
							<MenuShortcut keys={["Enter"]} />
						</CommandItem>
					</CommandGroup>
				) : null}
				{state === "linked" ? (
					<>
						<CommandGroup heading="지금 링크">
							<EntryRow title="리액트 다시 만들기 1편 · 상태" collection="게시글" checked />
						</CommandGroup>
						<CommandSeparator />
						<CommandItem value="unlink">
							<Unlink aria-hidden />
							링크 떼기
						</CommandItem>
					</>
				) : null}
			</CommandList>
		</Command>
	);
}

/** The editor with words picked and the link card open under the format bar's link button. */
export function LinkCardScreen({ state }: { state: LinkCardState }) {
	return (
		<EditorPage
			header={
				<EntryHeader
					address="/posts/first-post"
					status="editing"
					statusLabel="수정 중"
					panel={false}
					panelOpen={false}
				/>
			}
			statusBar={null}
		>
			<EntryTitle>첫 번째 글</EntryTitle>
			<Paragraph>블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.</Paragraph>
			<BodyBlock gap={32}>
				<BodyHeading>무엇을 덜어냈나</BodyHeading>
			</BodyBlock>
			<BodyBlock gap={12}>
				<Paragraph>목록에는 제목과 주소, 지금 상태만 남겼다. 나머지는 필요할 때 꺼내 본다.</Paragraph>
			</BodyBlock>
			<BodyBlock gap={20}>
				<Box position="relative">
					{/* design-allow: the format bar floats over the picked words, where the editor's bubble puts it */}
					<div style={{ position: "absolute", top: -42, left: 150 }}>
						<FloatingBar>
							<FormatButton mark="bold" label="굵게" />
							<FormatButton mark="italic" label="기울임" />
							<FormatButton mark="underline" label="밑줄" />
							<FormatButton mark="strike" label="취소선" />
							<FormatButton mark="code" label="코드" />
							<Separator orientation="vertical" length="bar" />
							<FormatButton mark="superscript" label="위 첨자" />
							<FormatButton mark="subscript" label="아래 첨자" />
							<Popover open modal={false}>
								<FormatButton
									mark="link"
									label="링크"
									pressed={state === "linked"}
									trigger={(button) => <PopoverTrigger render={button} />}
								/>
								<PopoverContent side="bottom" align="center" padding="menu" width="md" initialFocus={false}>
									<LinkCard state={state} />
								</PopoverContent>
							</Popover>
						</FloatingBar>
					</div>
					<Paragraph>
						상태를 다루는 방식은 <RequestAnchor>지난 글</RequestAnchor>에 정리해 두었다.
					</Paragraph>
				</Box>
			</BodyBlock>
		</EditorPage>
	);
}
