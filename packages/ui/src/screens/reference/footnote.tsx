import {
	Box,
	EditorBody,
	FloatingBar,
	FormatBarRequest,
	FormatButton,
	RequestAnchor,
	Separator,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
} from "../../index";
import { EditorPage, EntryHeader, EntryTitle } from "./editor-notion";

/** Putting in a footnote (T62): the words picked with the format bar open, or the footnote just put in, the caret in its text at the end. */
export type FootnoteState = "picked" | "added";

/**
 * A footnote from the format bar: "Note¹" puts a numbered mark after the picked words and a footnote of the same number at the end of the body, with the
 * caret in it. Footnotes are numbered in the order their marks come in the text, and always sit together at the end, under a rule. Clicking a
 * mark goes to its footnote; clicking a footnote's number goes back. Taking out a footnote's last mark takes the footnote out with it (⌘Z puts both back).
 */
export function FootnoteScreen({ state }: { state: FootnoteState }) {
	const added = state === "added";
	const mark = "align-super text-monti-caption text-monti-muted";
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
			statusBar={
				<StatusBar>
					<StatusBarCell tone="warning">저장 전 변경사항</StatusBarCell>
					<StatusBarSpacer />
					<StatusBarCell end render={<span />}>
						1,262자
					</StatusBarCell>
				</StatusBar>
			}
		>
			<EntryTitle>첫 번째 글</EntryTitle>
			<EditorBody>
				<div className="ProseMirror">
					<Box position="relative">
						{added ? null : (
							// design-allow: the format bar floats over the picked words, where the editor's bubble puts it
							<div style={{ position: "absolute", top: -44, left: 120 }}>
								<FloatingBar>
									<FormatButton mark="bold" label="굵게" />
									<FormatButton mark="italic" label="기울임" />
									<FormatButton mark="underline" label="밑줄" />
									<FormatButton mark="strike" label="취소선" />
									<FormatButton mark="code" label="코드" />
									<Separator orientation="vertical" length="bar" />
									<FormatButton mark="superscript" label="위 첨자" />
									<FormatButton mark="subscript" label="아래 첨자" />
									<FormatButton mark="link" label="링크" />
									<FormatButton mark="footnote" label="각주" />
									<Separator orientation="vertical" length="bar" />
									<FormatBarRequest label="요청" />
								</FloatingBar>
							</div>
						)}
						<p>
							블로그를 다시 만들기로 한 건{" "}
							{added ? (
								<>
									글을 쓰는 시간보다 도구를 고치는 시간<sup className={mark}>1</sup>
								</>
							) : (
								<RequestAnchor>글을 쓰는 시간보다 도구를 고치는 시간</RequestAnchor>
							)}
							이 길어졌기 때문이다.
						</p>
					</Box>
					<h2>무엇을 덜어냈나</h2>
					<p>
						목록에는 제목과 주소, 지금 상태만 남겼다<sup className={mark}>{added ? 2 : 1}</sup>. 나머지는 필요할 때 꺼내
						본다.
					</p>
					<p>
						처음 만든 건 2019년이다<sup className={mark}>{added ? 3 : 2}</sup>.
					</p>
					{/* The footnotes: together at the end, under a rule, numbered as their marks come. */}
					<Box paddingTop={12}>
						<hr />
					</Box>
					<ol className="text-monti-body text-monti-muted">
						{added ? (
							<li>
								{/* design-allow: the caret, where the new footnote's text goes */}
								<span className="inline-block h-[1.1em] w-px translate-y-[2px] bg-monti-emphasis" />
							</li>
						) : null}
						<li>상태는 색 대신 글자로 적었다.</li>
						<li>처음 판은 정적 사이트 생성기로 만들었다.</li>
					</ol>
				</div>
			</EditorBody>
		</EditorPage>
	);
}
