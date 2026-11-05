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

/** What is picked: words with formats on part of them, or the same words after "clear formatting". */
export type FormatClearState = "formatted" | "cleared";

/**
 * Taking formats off (2026-11-06, owner): "서식 지우기" at the end of the text formats takes every format off the picked words at once (not a link),
 * and is there only while they have one. A format only some of the words have is off on its button, as in other editors: its press gives it to all.
 */
export function FormatClearScreen({ state }: { state: FormatClearState }) {
	const formatted = state === "formatted";
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
						1,240자
					</StatusBarCell>
				</StatusBar>
			}
		>
			<EntryTitle>첫 번째 글</EntryTitle>
			<EditorBody>
				<div className="ProseMirror">
					<p>블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.</p>
					<h2>무엇을 덜어냈나</h2>
					<p>목록에는 제목과 주소, 지금 상태만 남겼다. 나머지는 필요할 때 꺼내 본다.</p>
					<Box position="relative">
						{/* design-allow: the format bar floats over the picked words, where the editor's bubble puts it */}
						<div style={{ position: "absolute", top: -44, left: 40 }}>
							<FloatingBar>
								<FormatButton mark="bold" label="굵게" />
								<FormatButton mark="italic" label="기울임" />
								<FormatButton mark="underline" label="밑줄" />
								<FormatButton mark="strike" label="취소선" />
								<FormatButton mark="code" label="코드" />
								{formatted ? <FormatButton mark="clear" label="서식 지우기" /> : null}
								<Separator orientation="vertical" length="bar" />
								<FormatButton mark="superscript" label="위 첨자" />
								<FormatButton mark="subscript" label="아래 첨자" />
								<FormatButton mark="link" label="링크" />
								<Separator orientation="vertical" length="bar" />
								<FormatBarRequest label="요청" />
							</FloatingBar>
						</div>
						<p>
							편집기도{" "}
							<RequestAnchor>
								{formatted ? (
									<>
										<strong>같은 원칙</strong>
										<em>으로</em> 정리했다
									</>
								) : (
									"같은 원칙으로 정리했다"
								)}
							</RequestAnchor>
							. 글을 쓰는 동안 보이는 건 글뿐이다.
						</p>
					</Box>
				</div>
			</EditorBody>
		</EditorPage>
	);
}
