import { type Doc, sameJson } from "@monti-cms/core";
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
import { useOperation, useRead } from "../../operations/use-operation";

type Template = { id: string; name: string; doc: Doc; version: number };

const EMPTY: Doc = { type: "doc", blocks: [] };

/**
 * The template editor (tools.md, doc 03): a page of its own, outside the frame. The name stands where an entry's title does, over the body with every
 * block the site has. Save is the page's one pill; "not saved" shows while something changed. A save refused because the template was saved
 * elsewhere first shows the banner that loads the latest.
 */
export function TemplateEditor({
	id,
	onBack,
	onSaved,
}: {
	/** `null` for a new template. */
	id: string | null;
	onBack: () => void;
	/** A new template was saved: the page goes on as that template's. */
	onSaved: (id: string) => void;
}) {
	const { t } = useAdmin();
	const catalogs = useBodyCatalogs();
	const saved = useRead<Template>("templates.get", { id: id ?? "" }, { skip: id === null });
	const base = useMemo<Template | null>(
		() => (id ? (saved.data as Template | null) : { id: "", name: "", doc: EMPTY, version: 0 }),
		[id, saved.data],
	);
	const save = useOperation<{ id: string }>("templates.save");
	const duplicate = useOperation<{ id: string }>("templates.duplicate");
	const remove = useOperation("templates.remove");
	const [name, setName] = useState<string | null>(null);
	const [doc, setDoc] = useState<Doc | null>(null);
	const [loaded, setLoaded] = useState(0);
	const [conflict, setConflict] = useState(false);
	const [nameMissing, setNameMissing] = useState(false);

	const shownName = name ?? base?.name ?? "";
	const shownDoc = doc ?? base?.doc ?? EMPTY;
	const changed = base !== null && (shownName !== base.name || !sameJson(shownDoc, base.doc));
	const drop = () => {
		setName(null);
		setDoc(null);
		setLoaded((count) => count + 1);
	};
	useLeaveGuard({ changes: changed ? [true] : [], revertAll: drop });

	const write = async () => {
		if (!base) return;
		if (shownName.trim() === "") return setNameMissing(true);
		const answer = await save.run({
			...(id ? { id, version: base.version } : {}),
			name: shownName.trim(),
			doc: shownDoc,
		});
		if (!answer.ok) {
			if (answer.refusal.error === "conflict") setConflict(true);
			return;
		}
		setConflict(false);
		if (!id) return onSaved(answer.body.id);
		await saved.reload();
		setName(null);
		setDoc(null);
	};

	const loadLatest = async () => {
		await saved.reload();
		setConflict(false);
		drop();
	};

	return (
		<Stack gap={0} height="screen" overflow="clip" background="page">
			<EditorHeader>
				<Inline gap={16} minWidth={0} paddingX={12}>
					<TextButton variant="quiet" onClick={onBack}>
						<ChevronLeft aria-hidden />
						{t("templates.back")}
					</TextButton>
					{changed ? <EntryStatus status="editing">{t("templates.unsaved")}</EntryStatus> : null}
				</Inline>
				<Inline gap={16} justify="end">
					<Button variant="primary" loading={save.pending} onClick={() => void write()}>
						{t("templates.save")}
					</Button>
					{id ? (
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
										if (copy.ok) onSaved(copy.body.id);
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
					<Separator orientation="vertical" length="control" flush />
					<IconButton label={t("frame.assistant")} side="bottom">
						<Spark aria-hidden />
					</IconButton>
				</Inline>
			</EditorHeader>
			{saved.refusal && !saved.data ? (
				<Banner tone="danger" title={t("templates.loadFailed")} plainMeta>
					<TextButton onClick={() => void saved.reload()}>{t("templates.retry")}</TextButton>
				</Banner>
			) : null}
			{conflict ? (
				<Banner tone="danger" title={t("templates.conflict")} plainMeta>
					<TextButton onClick={() => void loadLatest()}>{t("templates.loadLatest")}</TextButton>
				</Banner>
			) : null}
			<Stack gap={0} grow minHeight={0} overflow="y" paddingX={48} paddingTop={16}>
				<Stack gap={0} grow width="full" maxWidth="reading" centered paddingBottom={48}>
					<Stack gap={0} paddingTop={16} paddingBottom={32}>
						<FormField>
							<FormFieldLabel htmlFor="monti-template-name" hidden>
								{t("templates.name")}
							</FormFieldLabel>
							<Input
								id="monti-template-name"
								value={shownName}
								placeholder={t("templates.name")}
								size="display"
								appearance="inline"
								aria-invalid={nameMissing && shownName.trim() === "" ? true : undefined}
								onChange={(event) => {
									setName(event.target.value);
									setNameMissing(false);
								}}
							/>
							{nameMissing && shownName.trim() === "" ? (
								<FormFieldError>{t("templates.nameMissing")}</FormFieldError>
							) : null}
						</FormField>
						<EditorTitleRule />
					</Stack>
					{base && catalogs ? (
						<BodyEditor key={`${base.version}:${loaded}`} doc={shownDoc} catalogs={catalogs} onChange={setDoc} />
					) : null}
				</Stack>
			</Stack>
			<StatusBar>
				<StatusBarSpacer />
				<StatusBarCell end render={<span />}>
					{t("templates.chars", { count: docLength(shownDoc) })}
				</StatusBarCell>
			</StatusBar>
		</Stack>
	);
}
