import {
	Affix,
	Button,
	FormField,
	FormFieldError,
	FormFieldLabel,
	FormFieldLegend,
	FormFieldSet,
	Inline,
	Input,
	LockMark,
	RadioGroup,
	RadioItem,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	Switch,
} from "@monti-cms/ui";
import { useRef, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { addressOf, addressPart } from "./basics-tab";
import { at, type DraftField } from "./schema-draft";
import type { CollectionsDraft } from "./use-collections-draft";

/** A collection's identifier: the schema's rule (`checkSchema`), so a wrong one is caught before it is made. */
const IDENTIFIER = /^[a-z][a-zA-Z0-9]*$/;

/**
 * The new collection sheet (flow 4, steps 01–02): its name, its identifier (fixed once made), its kind and its public address. Its create button puts it in the
 * draft with `title` and `slug`, the two fields every collection starts with (step 03); the review applies it.
 */
export function NewCollectionSheet({
	model,
	open,
	onClose,
	onMade,
}: {
	model: CollectionsDraft;
	open: boolean;
	onClose: () => void;
	onMade: (collection: string) => void;
}) {
	return (
		<Sheet open={open} onOpenChange={(next) => !next && onClose()}>
			{open ? <Body model={model} onClose={onClose} onMade={onMade} /> : null}
		</Sheet>
	);
}

function Body({
	model,
	onClose,
	onMade,
}: {
	model: CollectionsDraft;
	onClose: () => void;
	onMade: (collection: string) => void;
}) {
	const { t } = useAdmin();
	const [label, setLabel] = useState("");
	const [id, setId] = useState("");
	const [kind, setKind] = useState<"document" | "item">("document");
	const [publicPage, setPublicPage] = useState(false);
	const [path, setPath] = useState<string | null>(null);
	const taken = model.collections.includes(id);
	// Creating is never greyed out (README principle 7): pressed with a field empty, that field says so and takes the focus.
	const [tried, setTried] = useState(false);
	const nameInput = useRef<HTMLInputElement>(null);
	const idInput = useRef<HTMLInputElement>(null);
	const labelError = tried && label.trim() === "" ? t("settings.fillIn") : null;
	const error = !id
		? tried
			? t("settings.fillIn")
			: null
		: !IDENTIFIER.test(id)
			? t("settings.new.badId")
			: taken
				? t("settings.field.nameTaken")
				: null;
	const ready = label.trim() !== "" && id !== "" && error === null;
	const address = path ?? addressOf(id);

	const make = () => {
		if (!ready) {
			setTried(true);
			(label.trim() === "" ? nameInput : idInput).current?.focus();
			return;
		}
		const { draft } = model;
		draft.set(at.collection(id), { kind });
		if (kind === "document" || publicPage) draft.set(at.path(id), address);
		draft.set(at.collectionValue(id, "label"), label.trim());
		draft.set(at.field(id, "title"), { name: "title", def: { kind: "text", required: true } } satisfies DraftField);
		draft.set(at.field(id, "slug"), {
			name: "slug",
			def: { kind: "slug", required: true, from: "title" },
		} satisfies DraftField);
		onMade(id);
	};

	return (
		<SheetContent>
			<SheetHeader>
				<SheetTitle>{t("settings.new.title")}</SheetTitle>
			</SheetHeader>
			<SheetBody>
				<FormField>
					<FormFieldLabel htmlFor="collection-name" required>
						{t("settings.new.name")}
					</FormFieldLabel>
					<Input
						ref={nameInput}
						id="collection-name"
						required
						value={label}
						aria-invalid={labelError ? true : undefined}
						onChange={(event) => setLabel(event.target.value)}
					/>
					{labelError ? <FormFieldError>{labelError}</FormFieldError> : null}
				</FormField>
				<FormField>
					<Inline gap={6} align="center">
						<FormFieldLabel htmlFor="collection-id" required>
							{t("settings.basics.identifier")}
						</FormFieldLabel>
						<LockMark label={t("settings.basics.fixed")} />
					</Inline>
					<Input
						ref={idInput}
						id="collection-id"
						mono
						required
						value={id}
						aria-invalid={error ? true : undefined}
						onChange={(event) => setId(event.target.value.trim())}
					/>
					{error ? <FormFieldError>{error}</FormFieldError> : null}
				</FormField>
				<FormFieldSet>
					<FormFieldLegend variant="field">{t("settings.basics.kind")}</FormFieldLegend>
					<RadioGroup
						aria-label={t("settings.basics.kind")}
						value={kind}
						onValueChange={(value) => setKind(value as "document" | "item")}
					>
						<RadioItem
							value="document"
							label={t("settings.new.document")}
							description={t("settings.new.documentHint")}
						/>
						<RadioItem value="item" label={t("settings.new.item")} description={t("settings.new.itemHint")} />
					</RadioGroup>
				</FormFieldSet>
				<FormField>
					<FormFieldLabel
						htmlFor={kind === "document" || publicPage ? "collection-address" : undefined}
						action={
							kind === "item" ? (
								<Switch
									checked={publicPage}
									aria-label={t("settings.basics.publicPage")}
									onCheckedChange={setPublicPage}
								/>
							) : undefined
						}
					>
						{t("settings.basics.path")}
					</FormFieldLabel>
					{(kind === "document" || publicPage) && (
						<Affix
							id="collection-address"
							prefix="/"
							suffix="/:slug"
							width="fit"
							value={addressPart(address)}
							onChange={(event) => setPath(addressOf(event.target.value))}
						/>
					)}
				</FormField>
			</SheetBody>
			<SheetFooter>
				<Button variant="ghost" onClick={onClose}>
					{t("settings.cancel")}
				</Button>
				<Button onClick={make}>{t("settings.new.make")}</Button>
			</SheetFooter>
		</SheetContent>
	);
}
