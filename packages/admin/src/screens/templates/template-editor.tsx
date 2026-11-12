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
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	TextButton,
} from "@monti-cms/ui";
import { ChevronLeft, OverflowMenuHorizontal, Spark } from "@monti-cms/ui/icons";
import { useMemo, useState } from "react";
import { useLeaveGuard } from "../../draft/leave-guard";
import { BodyEditor } from "../../editor/body-editor";
import { docLength, useBodyCatalogs } from "../../editor/use-body-editor";
import { useAdmin } from "../../operations/admin-context";
import { useOperation } from "../../operations/use-operation";
import { useEntryEditor } from "../entry/use-entry-editor";
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
	const { t } = useAdmin();
	const catalogs = useBodyCatalogs();
	const source = useMemo(() => ({ kind: "template" as const, id }), [id]);
	const editor = useEntryEditor(source);
	const duplicate = useOperation<{ output: { id: string } }>("templates.duplicate");
	const remove = useOperation("templates.remove");
	const [nameMissing, setNameMissing] = useState(false);
	useLeaveGuard({ changes: editor.draft.changes, revertAll: editor.draft.revertAll });

	const name = editor.title;
	const write = async () => {
		if (name.trim() === "") return setNameMissing(true);
		const saved = await editor.save();
		if (saved && !id) onSaved(saved.id);
	};

	return (
		<Stack gap={0} height="screen" overflow="clip" background="page">
			{/* Every banner of the screen stands at its very top, broader first (common.md, banners). */}
			<SessionEndedBanner />
			{editor.loadRefusal ? (
				<Banner tone="danger" title={t("templates.loadFailed")} plainMeta>
					<TextButton onClick={() => void editor.reload()}>{t("templates.retry")}</TextButton>
				</Banner>
			) : null}
			{editor.conflict ? (
				<Banner tone="danger" title={t("templates.conflict")} plainMeta>
					<TextButton onClick={() => void editor.loadLatest()}>{t("templates.loadLatest")}</TextButton>
				</Banner>
			) : null}
			{editor.browserCopy ? (
				<Banner title={t("entry.browserCopy")}>
					<TextButton onClick={editor.loadBrowserCopy}>{t("entry.loadCopy")}</TextButton>
					<TextButton variant="quiet" onClick={editor.dropBrowserCopy}>
						{t("entry.dropCopy")}
					</TextButton>
				</Banner>
			) : null}
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
					<IconButton label={t("frame.assistant")} side="bottom">
						<Spark aria-hidden />
					</IconButton>
				</Inline>
			</EditorHeader>
			<Stack gap={0} grow minHeight={0} overflow="y" paddingX={48} paddingTop={16}>
				<Stack gap={0} grow width="full" maxWidth="reading" centered paddingBottom={48}>
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
							onEditor={editor.keepBody}
						/>
					) : null}
				</Stack>
			</Stack>
			<StatusBar>
				<StatusBarSpacer />
				{editor.loaded ? (
					<StatusBarCell end render={<span />}>
						{t("templates.chars", { count: docLength(editor.doc) })}
					</StatusBarCell>
				) : null}
			</StatusBar>
		</Stack>
	);
}
