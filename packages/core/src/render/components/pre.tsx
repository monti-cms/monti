import type { CSSProperties, ReactNode } from "react";
import { showsLineNumbers } from "../code";
import { CmsCopyButton } from "./copy-button";

const parseNotes = (notes: string | undefined): string[] => {
	if (!notes) return [];
	try {
		const parsed: unknown = JSON.parse(notes);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
};

export interface CmsPreProps {
	readonly children?: ReactNode;
	/** 코드 원문(복사 단추). 코드 강조가 넣는다. */
	readonly code?: string;
	/** 파일 이름(`title="src/a.ts"`). 있으면 제목 줄을 보인다. */
	readonly title?: string;
	/** 줄 번호(코드 펜스 meta `lnum`·`showLineNumbers`). */
	readonly lnum?: boolean | string;
	readonly showLineNumbers?: boolean;
	/** 코드 안 툴팁 설명(번호 순서, JSON 배열). 마우스를 올릴 수 없는 화면에서 코드 아래 목록으로 보인다. */
	readonly notes?: string;
	readonly className?: string;
	readonly style?: CSSProperties;
	readonly copyLabel?: string;
	readonly copiedLabel?: string;
	readonly notesLabel?: string;
}

/**
 * 코드 블록 틀(코드 강조가 만든 `<pre>`). 제목 줄·복사 단추·줄 번호·코드 안 툴팁 목록을 붙이고, 강조가 남긴 속성
 * (`code`·`title`·`lnum`·`notes`)을 `<pre>`에 그대로 흘리지 않는다.
 */
export function CmsPre({
	children,
	code,
	title,
	lnum,
	showLineNumbers,
	notes,
	className,
	style,
	copyLabel = "Copy",
	copiedLabel = "Copied",
	notesLabel = "Code notes",
}: CmsPreProps) {
	const numbered = showsLineNumbers({ showLineNumbers, lnum });
	const noteList = parseNotes(notes);
	const path = title?.trim().split("/").filter(Boolean) ?? [];
	return (
		<div className="cms-code">
			{path.length > 0 ? (
				<div className="cms-code-title" data-title={title}>
					{path.map((part, index) => (
						<span key={`${index}-${part}`} className={index === path.length - 1 ? "cms-code-title-file" : undefined}>
							{part}
							{index < path.length - 1 ? " / " : ""}
						</span>
					))}
				</div>
			) : null}
			{/* CSS가 속성이 있기만 해도 줄 번호를 그린다. 꺼져 있으면 속성을 두지 않는다. */}
			<pre className={className} style={style} data-show-line-numbers={numbered || undefined}>
				{children}
			</pre>
			{code ? <CmsCopyButton text={code} label={copyLabel} copiedLabel={copiedLabel} /> : null}
			{noteList.length > 0 ? (
				<ol className="cms-code-notes" aria-label={notesLabel}>
					{noteList.map((note, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: 주석 번호가 곧 순서다
						<li key={index}>
							<span className="cms-code-note-number">{index + 1}</span>
							<span>{note}</span>
						</li>
					))}
				</ol>
			) : null}
		</div>
	);
}
