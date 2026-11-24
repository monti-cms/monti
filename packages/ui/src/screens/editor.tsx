import {
	Code,
	Copy,
	Document,
	Grid,
	Image,
	Link,
	ListBulleted,
	ListChecked,
	ListNumbered,
	OverflowMenuHorizontal,
	Quotes,
	Redo,
	Subtract,
	TextBold,
	TextItalic,
	TextStrikethrough,
	TextUnderline,
	Undo,
} from "../icons";
import {
	BlockBarPlace,
	BlockHandle,
	Caret,
	CodeArea,
	CodeFrame,
	CodeGround,
	CodeNumber,
	CodeToken,
	EditorMargin,
	EditorToolbar,
	EditorToolbarGroup,
	EditorToolbarSeparator,
	FloatingBar,
	FloatingBarButton,
	Separator,
	Text,
} from "../index";
import { DocBody, DocTitle, EditorScreen, EditorStatus, EditorTopBar, LanguageTabs } from "./editor-frame";

/** 코드 줄 하나: 낱말마다 색(밝게 · 어둡게). */
type CodeWord = readonly [string, string?, string?];

const KEYWORD = ["#b5442f", "#e8917d"] as const;
const NAME = ["#8a6a12", "#e6c07b"] as const;
const STRING = ["#3a7a52", "#8cc9a0"] as const;

const NAME_LINE: readonly CodeWord[] = [
	["export const", ...KEYWORD],
	[" "],
	["name", ...NAME],
	[" = "],
	['"monti"', ...STRING],
	[";"],
];

/** 편집기의 코드 블록(`CodeFrame`): 머리 줄(언어, 파일 이름), 번호, 줄. */
function DocCode({
	language,
	file,
	lines,
}: {
	language: string;
	file?: string;
	lines: readonly (readonly CodeWord[])[];
}) {
	return (
		<CodeFrame
			head={
				<Text variant="caption" tone="subtle">
					{language}
					{file ? (
						<>
							{" "}
							<Text mono tone="muted">
								{file}
							</Text>
						</>
					) : null}
				</Text>
			}
		>
			<CodeArea
				gutter={lines.map((_, at) => <CodeNumber key={at} number={at + 1} />)}
				grounds={lines.map((_, at) => <CodeGround key={at} />)}
			>
				{lines.map((line, at) => (
					<div key={at}>
						{line.map(([word, light, dark], index) =>
							light ? (
								<CodeToken key={index} light={light} dark={dark}>
									{word}
								</CodeToken>
							) : (
								word
							),
						)}
					</div>
				))}
			</CodeArea>
		</CodeFrame>
	);
}

/** 고른 코드 블록의 도구 줄: 언어, 파일 이름 · 줄 번호(켜짐), 복사, ⋯. */
function CodeBar() {
	return (
		<FloatingBar aria-label="코드 블록 도구">
			<FloatingBarButton named label="언어">
				<Text variant="caption">TypeScript</Text>
				<Caret />
			</FloatingBarButton>
			<Separator orientation="vertical" length="bar" />
			<FloatingBarButton label="파일 이름" pressed>
				<Document aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="줄 번호" pressed>
				<ListNumbered aria-hidden />
			</FloatingBarButton>
			<Separator orientation="vertical" length="bar" />
			<FloatingBarButton label="복사">
				<Copy aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="더 보기">
				<OverflowMenuHorizontal aria-hidden />
			</FloatingBarButton>
		</FloatingBar>
	);
}

/** 시안 `parts/doc-code.html`: 코드의 머리와 언어를 다룬 글, 첫 코드 블록이 골라져 도구 줄이 떠 있다. */
function CodeDoc() {
	return (
		<>
			<LanguageTabs others={["English"]} />
			<DocTitle>보기 모음 · 코드의 머리와 언어</DocTitle>
			<DocBody>
				<h2>머리 줄</h2>
				<h3>파일 이름이 있는 코드</h3>
				<p>머리 줄에 언어와 파일 이름.</p>
				<div data-block="codeBlock" data-selected="">
					<EditorMargin top={4} beside={-24}>
						<BlockHandle gripLabel="끌어 옮기기 · 메뉴" />
					</EditorMargin>
					<BlockBarPlace>
						<CodeBar />
					</BlockBarPlace>
					<DocCode language="TypeScript" file="src/name.ts" lines={[NAME_LINE]} />
				</div>
				<h3>파일 이름이 없는 코드</h3>
				<p>머리 줄에 언어만.</p>
				<div data-block="codeBlock">
					<DocCode language="TypeScript" lines={[NAME_LINE]} />
				</div>
				<h2>줄 번호</h2>
				<h3>줄 번호 켬</h3>
				<p>사이트에도 번호가 선다.</p>
				<div data-block="codeBlock">
					<DocCode
						language="JavaScript"
						lines={[
							[["const", ...KEYWORD], [" a = "], ["1", ...NAME], [";"]],
							[["const", ...KEYWORD], [" b = "], ["2", ...NAME], [";"]],
							[["console.log(a + b);"]],
						]}
					/>
				</div>
			</DocBody>
		</>
	);
}

/** 시안 `parts/doc-text-caret.html`: 글자 역할과 서식을 모두 쓴 글, 커서는 "bo|ld"에. */
function TextDoc() {
	return (
		<>
			<LanguageTabs />
			<DocTitle>보기 모음 · 글자와 목록</DocTitle>
			<DocBody>
				<h2>제목 크기</h2>
				<h3>셋째 크기 제목</h3>
				<h4>넷째 크기 제목</h4>
				<p>본문은 17px, 넷째 제목은 같은 크기의 굵은 글씨로 내려갑니다.</p>
				<h2>글자 서식</h2>
				<h4>서식 하나씩</h4>
				<p>굵게, 기울임, 밑줄, 취소선, 코드, 위첨자, 아래첨자를 하나씩.</p>
				<p>
					<b>bold</b> · <i>italic</i> · <u>underline</u> · <s>strike</s> · <code>code</code> · x<sup>sup</sup> · x
					<sub>sub</sub>
				</p>
				<h4>서식 여럿을 함께</h4>
				<p>한 글자에 서식 두셋을 겹쳐 건다.</p>
				<p>
					<b>
						<i>굵은 기울임</i>
					</b>
					,{" "}
					<b>
						<u>밑줄 친 굵게</u>
					</b>
					,{" "}
					<s>
						<code>지운 코드</code>
					</s>
					, 링크 안의{" "}
					<a href="#text">
						<b>굵은 글자</b>
					</a>
					.
				</p>
				<h2>링크</h2>
				<p>바깥 사이트, 이 사이트의 다른 글, 글 안의 제목, 메일.</p>
			</DocBody>
		</>
	);
}

/** 고정 도구 막대(시안 `editor-docked.html`): 되돌리기 | 글자 종류 | 서식 | 링크 | 목록 · 인용 | 그림 · 표 · 구분선. 커서가 굵은 글자 안에 있다. */
export function DockedToolbar() {
	return (
		<EditorToolbar aria-label="서식">
			<EditorToolbarGroup>
				<FloatingBarButton label="되돌리기" shortcut={["mod", "Z"]}>
					<Undo aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="다시 하기" shortcut={["mod", "shift", "Z"]} disabled>
					<Redo aria-hidden />
				</FloatingBarButton>
			</EditorToolbarGroup>
			<EditorToolbarSeparator />
			<FloatingBarButton named label="글자 종류">
				<Text variant="caption">본문</Text>
				<Caret />
			</FloatingBarButton>
			<EditorToolbarSeparator />
			<EditorToolbarGroup>
				<FloatingBarButton label="굵게" shortcut={["mod", "B"]} pressed>
					<TextBold aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="기울임" shortcut={["mod", "I"]}>
					<TextItalic aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="밑줄" shortcut={["mod", "U"]}>
					<TextUnderline aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="취소선">
					<TextStrikethrough aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="코드">
					<Code aria-hidden />
				</FloatingBarButton>
			</EditorToolbarGroup>
			<EditorToolbarSeparator />
			<FloatingBarButton label="링크" disabled>
				<Link aria-hidden />
			</FloatingBarButton>
			<EditorToolbarSeparator />
			<EditorToolbarGroup>
				<FloatingBarButton label="글머리 목록">
					<ListBulleted aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="번호 목록">
					<ListNumbered aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="할 일 목록">
					<ListChecked aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="인용">
					<Quotes aria-hidden />
				</FloatingBarButton>
			</EditorToolbarGroup>
			<EditorToolbarSeparator />
			<EditorToolbarGroup>
				<FloatingBarButton label="그림">
					<Image aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="표">
					<Grid aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="구분선">
					<Subtract aria-hidden />
				</FloatingBarButton>
			</EditorToolbarGroup>
		</EditorToolbar>
	);
}

/** 시안 `editor.html`: 발행된 글, 바뀐 것 없음. 코드 블록이 골라져 있다. */
export function EditorCodeScreen() {
	return (
		<EditorScreen
			top={<EditorTopBar folder="보기 모음" title="보기 모음 · 코드의 머리와 언어" publish="published" />}
			status={<EditorStatus save="저장됨" count="3,402" />}
		>
			<CodeDoc />
		</EditorScreen>
	);
}

/** 시안 `editor-docked.html` · `editor-docked-narrow.html`: 고정 도구 막대, 발행 뒤 바뀜, 아래로 내려 읽는 중. */
export function EditorDockedScreen() {
	return (
		<EditorScreen
			top={<EditorTopBar folder="보기 모음" title="보기 모음 · 글자와 목록" publish="changes" />}
			dock={<DockedToolbar />}
			status={<EditorStatus save="저장 안 됨 · 2초 전 입력" count="1,208" />}
		>
			<TextDoc />
		</EditorScreen>
	);
}

export { TextDoc };
