"use client";

import {
	type ApiKeyList,
	type ApiKeyServiceView,
	type ApiKeySlotView,
	type ApiKeyView,
	freeKeyName,
	useSite,
	useTranslator,
} from "@monti-cms/core/site";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Banner,
	Box,
	Button,
	DescriptionItem,
	DescriptionList,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	FormFieldError,
	FormFieldLabel,
	Input,
	ListSection,
	ListSectionRow,
	MenuField,
	MenuShortcut,
	PickList,
	PickListItem,
	PickListLabel,
	PickListSeparator,
	SavedValue,
	SecretInput,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { Fragment, type ReactNode, useId, useState } from "react";
import { apiKeysKeys, createApiKey, deleteApiKey, putApiKeySlot, updateApiKey, useApiKeys } from "../../api/api-keys";
import { CmsApiError, errorText } from "../../api/client";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { commonMessages } from "../../lib/common.messages";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { ToolsFrame } from "../tools/tools-frame";
import { formatTokens, hostOf, slotRows } from "./key-rows";
import { useKeySections } from "./key-sections";
import { apiKeysMessages } from "./messages";

type Open =
	| { kind: "pick" }
	| { kind: "add"; service: string; slot?: ApiKeySlotView }
	| { kind: "edit"; key: ApiKeyView }
	| { kind: "delete"; key: ApiKeyView };

/**
 * Tools › API keys (flow 10). A key is a whole connection: the saved keys with this month's tokens and one Edit · Delete each, the sections plugins add
 * (the AI plugin's quick-task model), and the keys plugins ask for. "+ Add key" picks the service first, then the name and the key, and the key is
 * checked with the service before it is saved.
 */
export function ApiKeysSettings() {
	const t = useTranslator(apiKeysMessages);
	const tc = useTranslator(commonMessages);
	const site = useSite();
	const query = useApiKeys();
	const sections = useKeySections();
	const [open, setOpen] = useState<Open | null>(null);
	const list: ApiKeyList | undefined = query.data;
	const close = () => setOpen(null);
	const unreadable = list?.items.filter((key) => !key.readable).length ?? 0;
	const noSecret = list !== undefined && !list.secretsAvailable;

	return (
		<ToolsFrame
			tab="api-keys"
			actions={
				<Button type="button" disabled={!list || noSecret} onClick={() => setOpen({ kind: "pick" })}>
					<span aria-hidden>+</span>
					{t("add")}
				</Button>
			}
		>
			<Stack gap={0} data-testid="api-keys-settings">
				{unreadable > 0 && (
					<Box paddingTop={24}>
						<Banner title={t("banner.unreadable", { count: unreadable })} meta={t("banner.unreadableWhy")} plainMeta />
					</Box>
				)}
				{noSecret && (
					<Box paddingTop={24}>
						<Banner title={t("banner.noSecret")} meta={t("banner.noSecretWhy")} plainMeta />
					</Box>
				)}
				{!list ? (
					<Box paddingY={24}>
						{query.error ? (
							<LoadErrorAlert
								message={errorText(site, query.error, t("load.failed"))}
								onRetry={() => void query.refetch()}
							/>
						) : (
							<Text as="p" variant="note" tone="subtle" role="status">
								{tc("loading")}
							</Text>
						)}
					</Box>
				) : (
					<Stack gap={40} paddingTop={32}>
						<ListSection title={t("section.keys")} count={list.items.length}>
							{list.items.length === 0 && <ListSectionRow title={t("row.none")} muted />}
							{list.items.map((key) => (
								<KeyRow
									key={key.id}
									apiKey={key}
									onEdit={() => setOpen({ kind: "edit", key })}
									onDelete={() => setOpen({ kind: "delete", key })}
								/>
							))}
						</ListSection>
						{Object.entries(sections).map(([name, Section]) => (
							<Section key={name} />
						))}
						<SlotSection list={list} onAdd={(slot) => setOpen({ kind: "add", service: slot.service, slot })} />
					</Stack>
				)}
			</Stack>
			{list && open?.kind === "pick" && (
				<ServiceDialog
					services={list.services}
					onPick={(service) => setOpen({ kind: "add", service })}
					onClose={close}
				/>
			)}
			{list && (open?.kind === "add" || open?.kind === "edit") && (
				<KeyDialog
					key={open.kind === "edit" ? open.key.id : `add:${open.service}`}
					open={open}
					list={list}
					onClose={close}
				/>
			)}
			{open?.kind === "delete" && <DeleteDialog apiKey={open.key} onClose={close} />}
		</ToolsFrame>
	);
}

function KeyRow({ apiKey, onEdit, onDelete }: { apiKey: ApiKeyView; onEdit: () => void; onDelete: () => void }) {
	const t = useTranslator(apiKeysMessages);
	const site = useSite();
	const unused = apiKey.readable && apiKey.usage === 0;
	return (
		<ListSectionRow
			data-testid={`api-key-${apiKey.name}`}
			title={apiKey.name}
			{...(apiKey.tail ? { titleCount: t("row.tail", { tail: apiKey.tail }) } : {})}
			meta={
				!apiKey.readable
					? t("row.unreadable")
					: unused
						? t("row.unused")
						: t("row.usage", { tokens: formatTokens(site, apiKey.usage) })
			}
			metaTone={!apiKey.readable ? "danger" : unused ? "faint" : "muted"}
			muted={unused}
			actions={
				<>
					<TextButton type="button" variant="underline" onClick={onEdit} aria-label={`${t("row.edit")} ${apiKey.name}`}>
						{t("row.edit")}
					</TextButton>
					<TextButton type="button" variant="quiet" onClick={onDelete} aria-label={`${t("row.delete")} ${apiKey.name}`}>
						{t("row.delete")}
					</TextButton>
				</>
			}
		/>
	);
}

/** The keys plugins ask for: a row per slot, which reads the first key of its service by itself; a slot whose service has no key says so and opens Add key with the service picked. */
function SlotSection({ list, onAdd }: { list: ApiKeyList; onAdd: (slot: ApiKeySlotView) => void }) {
	const t = useTranslator(apiKeysMessages);
	const choose = useCmsMutation({
		fn: ({ slot, keyId }: { slot: ApiKeySlotView; keyId: string }, { site }) =>
			putApiKeySlot(site, slot.plugin, slot.slot, keyId, t("error.save")),
		success: t("toast.saved"),
		failure: t("error.save"),
		invalidate: [apiKeysKeys.all],
	});
	const rows = slotRows(list);
	if (rows.length === 0) return null;
	const missing = rows.filter((row) => !row.slot.key).length;
	return (
		<ListSection
			title={t("section.plugins")}
			{...(missing > 0 && list.secretsAvailable ? { count: missing, countTone: "warning" as const } : {})}
		>
			{rows.map(({ slot, title, detail, keys }) => {
				const labelId = `slot-${slot.plugin}-${slot.slot}`;
				const field = (
					<MenuField
						aria-labelledby={labelId}
						value={slot.key?.name}
						{...(slot.key?.tail ? { meta: t("row.tail", { tail: slot.key.tail }) } : {})}
						placeholder={t("slot.empty")}
						warning={list.secretsAvailable}
						disabled={!list.secretsAvailable}
						{...(slot.key ? {} : { onClick: () => onAdd(slot) })}
					/>
				);
				return (
					<ListSectionRow
						key={labelId}
						data-testid={`api-key-slot-${slot.plugin}-${slot.slot}`}
						title={title}
						{...(detail ? { detail } : {})}
						meta={slot.plugin}
						metaTone="subtle"
						labelId={labelId}
						control={
							slot.key ? (
								<DropdownMenu>
									<DropdownMenuTrigger render={field} />
									<DropdownMenuContent align="end">
										<DropdownMenuRadioGroup
											value={slot.key.id}
											onValueChange={(keyId) => choose.mutate({ slot, keyId: keyId as string })}
										>
											{keys.map((key) => (
												<DropdownMenuRadioItem key={key.id} value={key.id}>
													{key.name}
													{key.tail && <MenuShortcut>{t("row.tail", { tail: key.tail })}</MenuShortcut>}
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							) : (
								field
							)
						}
					/>
				);
			})}
		</ListSection>
	);
}

/** Step one of adding a key: the service, AI services first, then the ones plugins ask for. Picking one goes on to the name and the key. */
function ServiceDialog({
	services,
	onPick,
	onClose,
}: {
	services: readonly ApiKeyServiceView[];
	onPick: (service: string) => void;
	onClose: () => void;
}) {
	const t = useTranslator(apiKeysMessages);
	const tc = useTranslator(commonMessages);
	const groups = (["ai", "plugin"] as const)
		.map((group) => ({ group, items: services.filter((service) => service.group === group) }))
		.filter((entry) => entry.items.length > 0);
	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent data-testid="api-key-services">
				<DialogHeader>
					<DialogTitle>{t("dialog.add")}</DialogTitle>
				</DialogHeader>
				<PickList aria-label={t("dialog.services")}>
					{groups.map(({ group, items }, index) => (
						<Fragment key={group}>
							{index > 0 && <PickListSeparator />}
							<PickListLabel>{t(`group.${group}`)}</PickListLabel>
							{items.map((service) => (
								<PickListItem
									key={service.id}
									{...(service.hint ? { mark: service.hint } : {})}
									onClick={() => onPick(service.id)}
								>
									{service.label}
								</PickListItem>
							))}
						</Fragment>
					))}
				</PickList>
				<DialogFooter>
					<TextButton type="button" onClick={onClose}>
						{tc("cancel")}
					</TextButton>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Step two of adding a key, or editing one. Adding: the service (changeable), the address for a service at one, the name (always shown, prefilled with the
 * service's name, or `name 2` with a line under it when that is taken) and the key. Editing: the service as text, the name, and the key as "··· a1b2 ·
 * Change", which opens an empty key field in place ("Keep" goes back); a key that cannot be read opens with the field and asks for it again. The key is
 * checked with the service before it is saved: a refused key keeps the dialog open with "This key doesn't match." under it.
 */
function KeyDialog({
	open,
	list,
	onClose,
}: {
	open: Extract<Open, { kind: "add" } | { kind: "edit" }>;
	list: ApiKeyList;
	onClose: () => void;
}) {
	const t = useTranslator(apiKeysMessages);
	const ids = { service: useId(), url: useId(), name: useId(), key: useId() };
	const editing = open.kind === "edit" ? open.key : null;
	const [serviceId, setServiceId] = useState(editing?.service ?? (open.kind === "add" ? open.service : ""));
	const service = list.services.find((entry) => entry.id === serviceId);
	const [url, setUrl] = useState("");
	const [typedName, setTypedName] = useState<string | null>(null);
	const [value, setValue] = useState("");
	const [replacing, setReplacing] = useState(editing ? !editing.readable : true);
	const [rejected, setRejected] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const others = list.items.filter((key) => key.id !== editing?.id).map((key) => key.name);
	const base = service?.url ? hostOf(url) || service.label : (service?.label ?? "");
	const prefilled = editing ? editing.name : freeKeyName(base, others);
	const name = typedName ?? prefilled;
	const taken = !editing && typedName === null && base !== "" && prefilled !== base;
	const keyOptional = service?.keyOptional === true;
	const ready =
		name.trim() !== "" &&
		(!service?.url || url.trim() !== "") &&
		// Editing, an empty key field keeps the saved key; only a key that cannot be read must be entered again.
		(editing ? editing.readable || value.trim() !== "" : keyOptional || value.trim() !== "");

	const save = useCmsMutation({
		fn: (_: undefined, { site }) => {
			if (!editing) {
				return createApiKey(
					site,
					{
						service: serviceId,
						name: name.trim(),
						...(service?.url ? { url: url.trim() } : {}),
						...(value.trim() ? { value: value.trim() } : {}),
					},
					t("error.save"),
				);
			}
			return updateApiKey(
				site,
				editing.id,
				{
					expectedVersion: editing.version,
					...(name.trim() !== editing.name ? { name: name.trim() } : {}),
					...(replacing && value.trim() ? { value: value.trim() } : {}),
				},
				t("error.save"),
			);
		},
		success: editing
			? t("toast.saved")
			: open.kind === "add" && open.slot
				? t("toast.slot", { label: service?.label ?? "" })
				: t("toast.added"),
		failure: t("error.save"),
		inline: true,
		invalidate: [apiKeysKeys.all],
		onSuccess: onClose,
		onError: (saveError, _variables) => {
			if (saveError instanceof CmsApiError && saveError.code === "key_rejected") {
				setRejected(true);
				return;
			}
			setError(saveError instanceof Error ? saveError.message : t("error.save"));
		},
	});
	const nothingChanged = editing !== null && name.trim() === editing.name && !(replacing && value.trim());

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent form data-testid="api-key-dialog">
				<Stack
					as="form"
					gap={20}
					onSubmit={(event) => {
						event.preventDefault();
						if (nothingChanged) {
							onClose();
							return;
						}
						if (ready && !save.isPending) {
							setError(null);
							setRejected(false);
							save.mutate(undefined);
						}
					}}
				>
					<DialogHeader>
						<DialogTitle {...(editing ? { of: editing.name } : {})}>
							{editing ? t("dialog.edit") : t("dialog.add")}
						</DialogTitle>
					</DialogHeader>
					<Stack gap={16}>
						<Field
							label={t("field.service")}
							htmlFor={editing || (open.kind === "add" && open.slot) ? undefined : ids.service}
						>
							{editing || (open.kind === "add" && open.slot) ? (
								<Box paddingY={6}>
									<Text>{service?.label ?? serviceId}</Text>
								</Box>
							) : (
								<Select
									items={list.services.map((entry) => ({ value: entry.id, label: entry.label }))}
									value={serviceId}
									onValueChange={(next) => {
										setServiceId(next as string);
										setTypedName(null);
										setRejected(false);
									}}
								>
									<SelectTrigger id={ids.service} width="full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{list.services.map((entry) => (
											<SelectItem key={entry.id} value={entry.id}>
												{entry.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</Field>
						{service?.url && !editing && (
							<Field label={t("field.url")} htmlFor={ids.url} required>
								<Input
									id={ids.url}
									mono
									required
									value={url}
									placeholder={service.url.placeholder}
									onChange={(event) => setUrl(event.target.value)}
								/>
							</Field>
						)}
						<Field label={t("field.name")} htmlFor={ids.name} required>
							<Input
								id={ids.name}
								required
								value={name}
								autoComplete="off"
								onChange={(event) => setTypedName(event.target.value)}
							/>
							{taken && (
								<Text as="p" variant="note" tone="subtle">
									{t("field.nameTaken", { name: base })}
								</Text>
							)}
						</Field>
						<Field label={t("field.key")} htmlFor={ids.key} required={!keyOptional && (!editing || !editing.readable)}>
							{editing && !replacing ? (
								<SavedValue action={{ label: t("key.replace"), onClick: () => setReplacing(true) }}>
									{t("row.tail", { tail: editing.tail })}
								</SavedValue>
							) : (
								<SecretInput
									id={ids.key}
									value={value}
									autoFocus={editing !== null || open.kind === "add"}
									required={!keyOptional && (!editing || !editing.readable)}
									aria-invalid={rejected || undefined}
									placeholder={keyOptional ? t("field.keyNone") : editing ? "" : (service?.keyPlaceholder ?? "")}
									showLabel={t("key.show")}
									hideLabel={t("key.hide")}
									onChange={(event) => {
										setValue(event.target.value);
										setRejected(false);
									}}
									{...(editing?.readable
										? {
												keep: {
													label: t("key.keep"),
													onClick: () => {
														setReplacing(false);
														setValue("");
														setRejected(false);
													},
												},
											}
										: {})}
								/>
							)}
							{rejected && <FormFieldError>{t("field.rejected")}</FormFieldError>}
							{editing && !editing.readable && (
								<Text as="p" variant="note" tone="subtle">
									{t("field.again")}
								</Text>
							)}
						</Field>
						{error && <FormFieldError>{error}</FormFieldError>}
					</Stack>
					<DialogFormFooter
						onCancel={onClose}
						busy={save.isPending}
						busyLabel={t("dialog.checking")}
						submitLabel={editing ? t("dialog.saveConfirm") : t("dialog.addConfirm")}
					/>
				</Stack>
			</DialogContent>
		</Dialog>
	);
}

/** A label over a control, 2px apart, with a red star for a required field (the add dialog has optional fields too). */
function Field({
	label,
	htmlFor,
	required = false,
	children,
}: {
	label: string;
	htmlFor?: string | undefined;
	required?: boolean;
	children: ReactNode;
}) {
	return (
		<Stack gap={2}>
			<FormFieldLabel {...(htmlFor ? { htmlFor } : {})} required={required}>
				{label}
			</FormFieldLabel>
			{children}
		</Stack>
	);
}

/** Deleting always asks, because it cannot be undone; a key in use lists what stops. */
function DeleteDialog({ apiKey, onClose }: { apiKey: ApiKeyView; onClose: () => void }) {
	const t = useTranslator(apiKeysMessages);
	const tc = useTranslator(commonMessages);
	const remove = useCmsMutation({
		fn: (_: undefined, { site }) =>
			deleteApiKey(site, apiKey, { force: apiKey.uses.length > 0, fallback: t("error.delete") }),
		success: t("toast.deleted"),
		failure: t("error.delete"),
		invalidate: [apiKeysKeys.all],
	});
	const used = apiKey.uses.length > 0;
	return (
		<AlertDialog open onOpenChange={(next) => !next && onClose()}>
			<AlertDialogContent data-testid="api-key-delete">
				<AlertDialogHeader>
					<AlertDialogTitle>{t("delete.title", { name: apiKey.name })}</AlertDialogTitle>
					<AlertDialogDescription>{used ? t("delete.used") : t("delete.unused")}</AlertDialogDescription>
				</AlertDialogHeader>
				{used && (
					<DescriptionList aria-label={t("delete.used")}>
						{apiKey.uses.map((use) => (
							<DescriptionItem key={`${use.plugin}:${use.ref}`} label={use.label} mono>
								{use.value ?? ""}
							</DescriptionItem>
						))}
					</DescriptionList>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel type="button">{tc("cancel")}</AlertDialogCancel>
					<AlertDialogAction
						type="button"
						variant="danger"
						onClick={() => {
							onClose();
							remove.mutate(undefined);
						}}
					>
						{t("delete.confirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
