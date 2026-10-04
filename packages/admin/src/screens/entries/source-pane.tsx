"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { X } from "lucide-react";
import { type Ref, useState } from "react";
import { useCmsAdminComponents } from "../../admin-components";
import { buildEditorExtensions } from "../../editor/extensions";
import { mdxToTiptap } from "../../editor/tiptap-content";
import { cn } from "../../lib/utils/cn";
import { IconButton } from "../../ui/icon-button";
import { t } from "./translate";

const PROSE =
	"prose cms-dark:prose-invert max-w-none text-base text-cms-foreground leading-relaxed focus:outline-none " +
	// 읽기 전용: 코드 블록 도구 줄은 숨기고, 접기 상자는 늘 펼쳐 보인다.
	"[&_[data-code-ui]]:hidden [&_[data-cms-collapsed]]:block " +
	// 번역 편집기에서 커서가 있는 블록에 대응하는 원문 블록(source-sync).
	// 막대 없이 옅은 배경만 블록 둘레로 번지게 한다(그림자 퍼짐이라 자리를 밀지 않고 목록 점도 감싼다).
	"[&_.cms-source-active]:rounded-sm [&_.cms-source-active]:bg-cms-primary/8 [&_.cms-source-active]:shadow-[0_0_0_12px_color-mix(in_oklab,var(--color-cms-primary)_8%,transparent)] [&_.cms-source-active]:transition-[background-color,box-shadow]";

function PreviewEditor({ mdx, label }: { mdx: string; label: string }) {
	// 글자 꾸밈 확장(글자색 등)의 모양도 편집기와 같게 그린다.
	const { marks } = useCmsAdminComponents();
	const [extensions] = useState(() => buildEditorExtensions(marks));
	const editor = useEditor({
		immediatelyRender: false,
		editable: false,
		extensions,
		content: mdxToTiptap(mdx),
		editorProps: { attributes: { "aria-label": label, class: PROSE } },
	});
	return <EditorContent editor={editor} />;
}

/** 읽기 전용 MDX 미리보기. 글 모양 그대로 그린다. 내용이 바뀌면 편집기를 새로 만든다. */
export function MdxPreview({ mdx, label = t("sourcePane.preview") }: { mdx: string; label?: string }) {
	return <PreviewEditor key={mdx} mdx={mdx} label={label} />;
}

/** 번역본 옆에 놓는 원문 전체(v3). 번역 편집기와 따로 스크롤한다. */
export function SourcePane({
	mdx,
	locale,
	title,
	onClose,
	className,
	ref,
}: {
	mdx: string;
	locale: string;
	/** 원문 제목. 번역 편집기의 제목 자리와 같게 본문 위에 크게 보인다. */
	title: string;
	onClose: () => void;
	className?: string;
	/** 스크롤하는 요소. 편집기와 스크롤을 잇는 데 쓴다. */
	ref?: Ref<HTMLElement>;
}) {
	return (
		<aside
			ref={ref}
			aria-label={t("sourcePane.aria")}
			className={cn("flex h-full min-w-0 flex-col overflow-y-auto border-r bg-cms-background", className)}
		>
			<div
				data-source-header
				className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-cms-background/95 px-4 backdrop-blur"
			>
				<h2 className="flex-1 font-medium text-sm">{t("sourcePane.heading", { locale: locale.toUpperCase() })}</h2>
				<IconButton label={t("close")} side="bottom" onClick={onClose}>
					<X aria-hidden className="size-4" />
				</IconButton>
			</div>
			<h1
				className={cn(
					"px-6 pt-12 pb-5 font-semibold text-[34px] leading-tight tracking-tight",
					!title && "text-cms-muted-foreground/40",
				)}
			>
				{title || t("untitled")}
			</h1>
			<div className="px-6 pt-6 pb-[35vh]">
				<MdxPreview mdx={mdx} label={t("sourcePane.body")} />
			</div>
		</aside>
	);
}
