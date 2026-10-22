"use client";

import { useTranslator } from "@monti-cms/core/site";
import { cn } from "@monti-cms/ui";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { SELECTED_RING } from "../block-model";
import { blocksMessages } from "../messages";
import { BlockFrame, useBlockEditor } from "../use-block-editor";

/** Name and input hint of blocks written as code and viewed as a preview (math and code fence blocks). */
export interface FenceEditorMeta {
	/** `data-fence-preview` value (e.g. `math`, the fence language). */
	readonly kind: string;
	readonly label: string;
	/** Example code shown when the input field is empty. */
	readonly placeholder: string;
	readonly preview: (value: string) => ReactNode;
}

const PROSEMIRROR_CURSOR_KEYS = new Set([
	"Enter",
	"Tab",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Backspace",
	"Delete",
	"Home",
	"End",
	"PageUp",
	"PageDown",
]);

/**
 * Edit view of a block written as code (`useBlockEditor().source`), showing the code input field and the preview together. Selecting or clicking opens the input field; otherwise only the preview shows.
 * Input is written to the document after a short pause or when leaving the field (not during Korean composition).
 */
export function FencePreviewBlockView({ meta }: { readonly meta: FenceEditorMeta }) {
	const t = useTranslator(blocksMessages);
	const block = useBlockEditor();
	const { kind } = meta;
	const value = block.source ?? "";
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState<string>(value);
	const [previewValue, setPreviewValue] = useState<string>(value);
	const lastCommittedRef = useRef<string>(value);
	const inputId = useId();
	const isComposingRef = useRef(false);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const draftRef = useRef<string>(draft);
	draftRef.current = draft;

	const containerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isEditable = block.editable;

	const setSourceRef = useRef(block.setSource);
	setSourceRef.current = block.setSource;

	const commitValue = (val: string) => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		setPreviewValue(val);
		if (val !== lastCommittedRef.current) {
			lastCommittedRef.current = val;
			block.setSource(val);
		}
	};

	useEffect(() => {
		if (!isComposingRef.current && value !== lastCommittedRef.current) {
			// An outside transaction (e.g. undo) changed the value. Cancel the pending input commit so it does not overwrite the new value.
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}
			lastCommittedRef.current = value;
			setDraft(value);
			setPreviewValue(value);
		}
	}, [value]);

	useEffect(() => {
		return () => {
			if (!debounceTimerRef.current && !isComposingRef.current) return;
			if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
			// Write input not yet committed to the document before disappearing. If the node is already deleted, there is nowhere to write.
			if (draftRef.current === lastCommittedRef.current) return;
			// Fails quietly when the node already left the document.
			setSourceRef.current(draftRef.current);
		};
	}, []);

	const isOpen = (block.selected || isEditing) && isEditable;

	const handleClick = () => {
		if (!isEditable) return;
		setIsEditing(true);
		// Move focus to the textarea when the node view is clicked
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
		});
	};

	const handleBlur = (e: React.FocusEvent) => {
		if (containerRef.current?.contains(e.relatedTarget as Node)) {
			return;
		}
		// Commit pending changes immediately on blur
		commitValue(draftRef.current);
		setIsEditing(false);
	};

	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setDraft(val);
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		// During composition, compositionend commits the final value.
		if (isComposingRef.current || (e.nativeEvent as InputEvent).isComposing) return;
		// Commit and refresh the preview after a debounce of about 400ms
		debounceTimerRef.current = setTimeout(() => {
			if (isComposingRef.current) return;
			commitValue(val);
		}, 400);
	};

	const handleCompositionStart = () => {
		isComposingRef.current = true;
	};

	const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
		isComposingRef.current = false;
		const val = e.currentTarget.value;
		setDraft(val);
		// Commit immediately when IME composition ends
		commitValue(val);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.metaKey || e.ctrlKey) {
			// The save shortcut is handled outside (the edit view). Write pending input to the document before that.
			if (e.key.toLowerCase() === "s") {
				commitValue(draftRef.current);
				return;
			}
			// Other combinations (select all, undo, Mac cursor movement) work only inside the input field.
			e.stopPropagation();
			return;
		}
		if (PROSEMIRROR_CURSOR_KEYS.has(e.key)) {
			// Stop propagation only for ProseMirror cursor keys, to keep the textarea's own behavior
			e.stopPropagation();
		}
	};

	const renderPreview = () => meta.preview(previewValue);

	// design-system: drawing — the preview block inside the document: the frame, the rendered preview and its source field are drawn in place
	return (
		<BlockFrame
			ref={containerRef}
			framed={false}
			selectedRing={false}
			data-fence-preview={kind}
			onBlur={handleBlur}
			className={cn(
				"group relative my-comfortable rounded-md border border-monti-muted bg-monti-surface p-normal transition-colors",
				isOpen && SELECTED_RING,
			)}
		>
			{isOpen ? (
				<div className="space-y-normal">
					<div className="flex items-center justify-between border-monti-muted border-b pb-tight text-monti-caption text-monti-muted">
						<span className="font-medium font-mono text-monti-caption">{meta.label}</span>
						<span className="text-monti-micro text-monti-subtle">
							{isEditing ? t("fence.editing") : t("fence.selected")}
						</span>
					</div>

					{/* Preview (shown at the top at the same time) */}
					<div className="min-h-[40px] rounded-md border border-monti-muted bg-monti-page p-condensed">
						{renderPreview()}
					</div>

					{/* Raw input field (mono, IME safe) */}
					<div className="space-y-tight">
						<label htmlFor={inputId} className="font-mono text-monti-caption text-monti-muted">
							{t("fence.sourceCode")}
						</label>
						<textarea
							id={inputId}
							ref={textareaRef}
							value={draft}
							placeholder={meta.placeholder}
							spellCheck={false}
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							onChange={handleTextChange}
							onCompositionStart={handleCompositionStart}
							onCompositionEnd={handleCompositionEnd}
							onKeyDown={handleKeyDown}
							className="field-sizing-content min-h-[96px] w-full resize-y rounded-md border border-monti-default bg-transparent px-normal py-condensed font-mono text-monti-body outline-none transition-[color,box-shadow] placeholder:text-monti-subtle focus-visible:border-monti-focus focus-visible:ring-3 focus-visible:ring-monti-focus-soft md:text-monti-body"
						/>
					</div>
				</div>
			) : (
				// When not selected, show only the preview
				<button
					type="button"
					onClick={handleClick}
					className="w-full cursor-pointer border-0 bg-transparent p-0 text-left font-inherit outline-none"
					aria-label={t("fence.edit", { label: meta.label })}
				>
					{draft.trim() ? (
						renderPreview()
					) : (
						<div className="rounded-md border border-monti-muted border-dashed p-comfortable text-center text-monti-caption text-monti-muted hover:border-monti-emphasis">
							{t("fence.enter", { label: meta.label })}
						</div>
					)}
				</button>
			)}
		</BlockFrame>
	);
}
