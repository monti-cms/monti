import {
	Banner,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	EditorHeader,
	EditorTitleRule,
	EntryStatus,
	FormField,
	FormFieldError,
	FormFieldLabel,
	IconButton,
	Inline,
	Input,
	Separator,
	Stack,
	StandalonePage,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	TextButton,
} from "@monti-cms/ui";
import { ChevronLeft, OverflowMenuHorizontal } from "@monti-cms/ui/icons";
import type { Editor } from "@tiptap/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { AssistantButton } from "../../assistant/assistant-button";
import { useLeaveGuard } from "../../draft/leave-guard";
import { BodyEditor } from "../../editor/body-editor";
import { CodeLinkBanner } from "../../editor/code/code-links";
import { docLength, useBodyCatalogs } from "../../editor/use-body-editor";
import { useAdmin } from "../../operations/admin-context";
import { useOperation } from "../../operations/use-operation";
import { DocumentToolRows, DocumentViewPane, useDocumentTools } from "../entry/document-tools";
import { useEntryEditor } from "../entry/use-entry-editor";
import { focusText, useFocusHandOff } from "../frame/focus-hand-off";
import { ReadFailedBanner } from "../frame/read-failed";
import { SessionEndedBanner } from "../frame/session-ended";

/**
 * The template editor (tools.md, doc 03): a page of its own, outside the frame. The name stands where an entry's title does, over the body with every
 * block the site has. Save is the page's one pill; "not saved" shows while something changed. It keeps its draft as the entry editor does
 * (`useEntryEditor`, T60): input waits in this browser until saved, and a save refused because the template was saved elsewhere first shows the banner
 * that loads the latest.
 */
export function TemplateEditor({
	id,
	onBack,
	onSaved,
}: {
	/** `null` for a new template. */
	id: string | null;
	onBack: () => void;
	/** A new template was saved, or a copy made: the page goes on as that template's. */
	onSaved: (id: string) => void;
}) {
	const { t, reads } = useAdmin();
	const catalogs = useBodyCatalogs();
	const source = useMemo(() => ({ kind: "template" as const, id }), [id]);
	const editor = useEntryEditor(source);
	const duplicate = useOperation<{ output: { id: string } }>("templates.duplicate");
	const remove = useOperation("templates.remove");
	const [nameMissing, setNameMissing] = useState(false);
	const tools = useDocumentTools();
	// A banner whose own action takes it away (discard or load this browser's copy, load the latest, try again) had the keyboard's focus on that
	// action: it goes to the text being written, the body, or the name when the body is not there (as in the entry editor).
	const body = useRef<Editor | null>(null);
	/** The body's editor as state too: the code link's strip at the top reads it (doc 17). */
	const [bodyEditor, setBodyEditor] = useState<Editor | null>(null);
	const keepBody = useCallback((made: Editor | null) => {
		body.current = made;
		setBodyEditor(made);
	}, []);
	const handOff = useFocusHandOff(() => () => focusText(() => body.current, "monti-template-name"));

	const name = editor.title;
	/** Saves the template. `true` when it went through; a missing name is said at the name. */
	const write = async (): Promise<boolean> => {
		if (name.trim() === "") {
			setNameMissing(true);
			return false;
		}
		const saved = await editor.save();
		if (saved && !id) onSaved(saved.id);
		return saved !== null;
	};
	useLeaveGuard({ changes: editor.draft.changes, revertAll: editor.draft.revertAll, save: write });

	return (
		<StandalonePage
			// Every banner of the screen stands at its very top, broader first (common.md, banners).
			banner={
				<>
					<SessionEndedBanner />
					<ReadFailedBanner />
					{editor.loadRefusal ? (
						<Banner ref={handOff} tone="danger" title={t("templates.loadFailed")} plainMeta>
							<TextButton onClick={() => void reads.retry()}>{t("templates.retry")}</TextButton>
						</Banner>
					) : null}
					{editor.conflict ? (
						<Banner ref={handOff} tone="danger" title={t("ui.savedElsewhere")} plainMeta>
							<TextButton onClick={() => void editor.loadLatest()}>{t("templates.loadLatest")}</TextButton>
						</Banner>
					) : null}
					<CodeLinkBanner editor={bodyEditor} />
					{editor.browserCopy ? (
						<Banner ref={handOff} title={t("entry.browserCopy")}>
							<TextButton onClick={editor.loadBrowserCopy}>{t("entry.loadCopy")}</TextButton>
							<TextButton variant="quiet" onClick={editor.dropBrowserCopy}>
								{t("entry.dropCopy")}
							</TextButton>
						</Banner>
					) : null}
				</>
			}
		>
			<EditorHeader>
				<Inline gap={16} minWidth={0} paddingX={12}>
					<TextButton variant="quiet" onClick={onBack}>
						<ChevronLeft aria-hidden />
						{t("templates.back")}
					</TextButton>
					{editor.dirty ? <EntryStatus status="editing">{t("templates.unsaved")}</EntryStatus> : null}
				</Inline>
				<Inline gap={16} justify="end">
					{/* What acts on the template waits for the template (T153): before it is read its name is not there, and "save" would ask for one. */}
					{editor.loaded ? (
						<>
							<Button variant="primary" loading={editor.saving} onClick={() => void write()}>
								{t("templates.save")}
							</Button>
							{/* The pill stands alone: the line sets it apart from the screen's tools (⋯, ✦). */}
							<Separator orientation="vertical" length="control" flush />
						</>
					) : null}
					{id && editor.loaded ? (
						<DropdownMenu>
							<IconButton
								label={t("templates.more")}
								side="bottom"
								trigger={(button) => <DropdownMenuTrigger render={button} />}
							>
								<OverflowMenuHorizontal aria-hidden />
							</IconButton>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={async () => {
										const copy = await duplicate.run({ id });
										if (copy.ok) onSaved(copy.body.output.id);
									}}
								>
									{t("templates.duplicate")}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DocumentToolRows tools={tools} />
								<DropdownMenuItem
									variant="danger"
									onClick={async () => {
										if ((await remove.run({ id })).ok) onBack();
									}}
								>
									{t("templates.remove")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
					<AssistantButton />
				</Inline>
			</EditorHeader>
			<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
				<Stack gap={0} grow minWidth={0} overflow="y" paddingX={48} paddingTop={16}>
					<Stack
						gap={0}
						grow
						width="full"
						maxWidth={tools.width === "full" ? undefined : "reading"}
						centered
						paddingBottom={48}
					>
						{/* Like the body, the name is not there before the template is read: what was typed in an empty name stood over the saved one (T153). */}
						{editor.loaded ? (
							<Stack gap={0} paddingTop={16} paddingBottom={32}>
								<FormField>
									<FormFieldLabel htmlFor="monti-template-name" hidden>
										{t("templates.name")}
									</FormFieldLabel>
									<Input
										id="monti-template-name"
										value={name}
										placeholder={t("templates.name")}
										size="display"
										appearance="inline"
										aria-invalid={nameMissing && name.trim() === "" ? true : undefined}
										onChange={(event) => {
											editor.set("title", event.target.value);
											setNameMissing(false);
										}}
									/>
									{nameMissing && name.trim() === "" ? (
										<FormFieldError>{t("templates.nameMissing")}</FormFieldError>
									) : null}
								</FormField>
								<EditorTitleRule />
							</Stack>
						) : null}
						{editor.loaded && catalogs ? (
							<BodyEditor
								key={editor.bodyKey}
								doc={editor.doc}
								files={editor.files}
								catalogs={catalogs}
								onChange={(doc) => editor.set("doc", doc)}
								onEditor={keepBody}
							/>
						) : null}
					</Stack>
				</Stack>
				{editor.loaded ? <DocumentViewPane tools={tools} doc={editor.doc} title={name} /> : null}
			</Inline>
			{/* As the entry editor: no status bar for a template that is not read yet. */}
			{editor.loaded ? (
				<StatusBar>
					<StatusBarSpacer />
					<StatusBarCell end render={<span />}>
						{t("templates.chars", { count: docLength(editor.doc) })}
					</StatusBarCell>
				</StatusBar>
			) : null}
		</StandalonePage>
	);
}
