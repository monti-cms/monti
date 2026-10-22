"use client";

import { type ApiKeyList, type ApiKeySlotView, type ApiKeyView, useSite, useTranslator } from "@monti-cms/core/site";
import { KeyRound, Pencil, Plus, RefreshCw, Trash2, Unplug } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { apiKeysKeys, createApiKey, deleteApiKey, putApiKeySlot, updateApiKey, useApiKeys } from "../../api/api-keys";
import { errorText } from "../../api/client";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { DialogFormFooter } from "../../ui/dialog-form-footer";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty";
import { FormFieldError } from "../../ui/field";
import { Input } from "../../ui/input";
import { Skeleton } from "../../ui/skeleton";
import { type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { PageActions } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { Labeled } from "../shared/labeled";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { type ApiKeyChoice, ApiKeyField, choiceReady } from "./api-key-field";
import { apiKeysMessages } from "./messages";

type Editing = { mode: "add" } | { mode: "rename" | "replace"; key: ApiKeyView };

/** The API keys page: one card with a row per key, the one primary action ("Add key") in the page header, and the dialogs to add, rename, replace and delete. */
export function ApiKeysSettings() {
	const t = useTranslator(apiKeysMessages);
	const query = useApiKeys();
	const [editing, setEditing] = useState<Editing | null>(null);
	const [slotEditing, setSlotEditing] = useState<ApiKeySlotView | null>(null);
	const { confirm, dialog } = useConfirm();
	const remove = useCmsMutation({
		fn: (key: ApiKeyView, { site }) =>
			deleteApiKey(site, key, { force: key.uses.length > 0, fallback: t("error.delete") }),
		success: t("toast.deleted"),
		failure: t("error.delete"),
		invalidate: [apiKeysKeys.all],
	});
	const clearSlot = useCmsMutation({
		fn: ({ plugin, slot }: { plugin: string; slot: string; label: string }, { site }) =>
			putApiKeySlot(site, plugin, slot, { use: "none" }, t("error.save")),
		success: (_result, { label }) => t("toast.slotCleared", { label }),
		failure: t("error.save"),
		invalidate: [apiKeysKeys.all],
	});
	const list: ApiKeyList | undefined = query.data;

	const askDelete = async (key: ApiKeyView) => {
		const used = key.uses.length > 0;
		const ok = await confirm({
			title: t("delete.title", { name: key.name }),
			description: used ? (
				<div className="flex flex-col gap-2">
					<p>{t("delete.usedDescription", { count: key.uses.length })}</p>
					<ul className="list-disc pl-4" data-testid="delete-dependents">
						{key.uses.map((use) => (
							<li key={`${use.plugin}:${use.ref}`}>{use.label}</li>
						))}
					</ul>
				</div>
			) : (
				t("delete.unusedDescription")
			),
			confirmLabel: t("delete.confirm"),
			destructive: true,
		});
		// A failure is toasted by the mutation.
		if (ok) await remove.mutateAsync(key).catch(() => {});
	};

	const rowMenu = (key: ApiKeyView): MenuAction[] => [
		{ kind: "item", label: t("menu.rename"), icon: Pencil, onSelect: () => setEditing({ mode: "rename", key }) },
		{ kind: "item", label: t("menu.replace"), icon: RefreshCw, onSelect: () => setEditing({ mode: "replace", key }) },
		...key.slots.map(
			(use): MenuAction => ({
				kind: "item",
				label: t("menu.clearSlot", { label: use.label }),
				icon: Unplug,
				onSelect: () => clearSlot.mutate({ plugin: use.plugin, slot: use.ref, label: use.label }),
			}),
		),
		{ kind: "separator" },
		{ kind: "item", label: t("menu.delete"), icon: Trash2, destructive: true, onSelect: () => askDelete(key) },
	];

	return (
		<div data-testid="api-keys-settings" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
			<PageActions>
				<Button type="button" size="sm" disabled={!list?.secretsAvailable} onClick={() => setEditing({ mode: "add" })}>
					<Plus aria-hidden />
					{t("add")}
				</Button>
			</PageActions>
			{list && !list.secretsAvailable && (
				<Alert variant="destructive" layout="stack" className="mx-8 mb-4 w-auto">
					<AlertTitle>{t("secret.title")}</AlertTitle>
					<AlertDescription>{t("secret.description")}</AlertDescription>
				</Alert>
			)}
			<div className="flex min-h-11 shrink-0 items-center border-monti-muted border-y px-8 text-monti-caption text-monti-muted">
				{list
					? [
							t("count.keys", { count: list.items.length }),
							...(list.slots.some((slot) => !slot.key)
								? [t("count.needed", { count: list.slots.filter((slot) => !slot.key).length })]
								: []),
						].join(" · ")
					: "\u00a0"}
			</div>
			<KeyRows
				query={query}
				menu={rowMenu}
				onAssign={setSlotEditing}
				onRetry={() => void query.refetch()}
				onAdd={() => setEditing({ mode: "add" })}
			/>
			<p className="px-8 py-4 text-monti-caption text-monti-muted">{t("note")}</p>
			{editing && (
				<KeyDialog
					key={editing.mode === "add" ? "add" : `${editing.mode}:${editing.key.id}`}
					editing={editing}
					taken={(list?.items ?? []).filter((item) => editing.mode === "add" || item.id !== editing.key.id)}
					onClose={() => setEditing(null)}
				/>
			)}
			{slotEditing && (
				<SlotDialog
					key={`${slotEditing.plugin}:${slotEditing.slot}`}
					slot={slotEditing}
					onClose={() => setSlotEditing(null)}
				/>
			)}
			{dialog}
		</div>
	);
}

function KeyRows({
	query,
	menu,
	onAssign,
	onRetry,
	onAdd,
}: {
	query: ReturnType<typeof useApiKeys>;
	menu: (key: ApiKeyView) => MenuAction[];
	onAssign: (slot: ApiKeySlotView) => void;
	onRetry: () => void;
	onAdd: () => void;
}) {
	const t = useTranslator(apiKeysMessages);
	const site = useSite();
	const list = query.data;
	if (!list) {
		if (query.error) {
			return (
				<LoadErrorAlert
					message={errorText(site, query.error, t("load.failed"))}
					onRetry={onRetry}
					className="mx-8 my-3"
				/>
			);
		}
		return <Skeleton className="mx-8 my-4 h-12" />;
	}
	const emptySlots = list.slots.filter((slot) => !slot.key);
	if (list.items.length === 0 && list.slots.length === 0) {
		return (
			<Empty className="min-h-64">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<KeyRound aria-hidden />
					</EmptyMedia>
					<EmptyTitle>{t("empty.title")}</EmptyTitle>
					<EmptyDescription>{t("empty.description")}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button type="button" size="sm" variant="outline" disabled={!list.secretsAvailable} onClick={onAdd}>
						<Plus aria-hidden />
						{t("add")}
					</Button>
				</EmptyContent>
			</Empty>
		);
	}
	return (
		<ul className="divide-y divide-monti-muted border-monti-muted border-b" aria-label={t("title")}>
			{list.items.map((key) => (
				<li key={key.id} className="flex items-center gap-3 px-8 py-3" data-testid={`api-key-${key.name}`}>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="truncate font-medium text-monti-body">{key.name}</span>
							{!key.readable && (
								<Badge variant="destructive" title={t("row.unreadableHint")}>
									{t("row.unreadable")}
								</Badge>
							)}
						</div>
						{!key.readable ? (
							<p className="mt-0.5 truncate text-monti-caption text-monti-muted">{t("row.unreadableHint")}</p>
						) : key.uses.length > 0 ? (
							<ul aria-label={t("row.usedBy")} className="mt-2 flex flex-wrap gap-1">
								{key.uses.map((use) => (
									<li
										key={`${use.plugin}:${use.ref}`}
										className="rounded-sm bg-monti-selected px-2 py-0.5 font-medium text-monti-caption text-monti-default"
									>
										{use.label}
									</li>
								))}
							</ul>
						) : (
							<p className="mt-0.5 truncate text-monti-caption text-monti-muted">{t("row.unused")}</p>
						)}
					</div>
					<span
						className="shrink-0 font-mono text-monti-caption text-monti-muted"
						title={key.tail ? t("row.mask", { tail: key.tail }) : t("row.maskShort")}
					>
						{"••••"}
						{key.tail}
					</span>
					<MoreActionsButton label={t("row.menu", { name: key.name })} actions={menu(key)} />
				</li>
			))}
			{emptySlots.map((slot) => (
				<li
					key={`${slot.plugin}:${slot.slot}`}
					className="flex items-center gap-3 px-8 py-3"
					data-testid={`api-key-slot-${slot.plugin}-${slot.slot}`}
				>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="truncate font-medium text-monti-body">{slot.label}</span>
							<span className="text-monti-caption text-monti-muted">{t("slot.empty")}</span>
						</div>
					</div>
					<Button
						type="button"
						variant="outline"
						size="xs"
						disabled={!list.secretsAvailable}
						onClick={() => onAssign(slot)}
					>
						{t("slot.assign")}
					</Button>
				</li>
			))}
		</ul>
	);
}

/** Pick a saved key or enter a new one for a plugin's key slot; a typed key is saved together with the assignment. */
function SlotDialog({ slot, onClose }: { slot: ApiKeySlotView; onClose: () => void }) {
	const t = useTranslator(apiKeysMessages);
	const site = useSite();
	const query = useApiKeys();
	const hasKeys = (query.data?.items.length ?? 0) > 0;
	const [choice, setChoice] = useState<ApiKeyChoice | null>(null);
	const current: ApiKeyChoice =
		choice ?? (hasKeys ? { use: "saved", keyId: query.data?.items[0]?.id ?? "" } : { use: "new", value: "" });
	const [error, setError] = useState<string | null>(null);
	const assign = useCmsMutation({
		fn: (choice: ApiKeyChoice, { site }) => putApiKeySlot(site, slot.plugin, slot.slot, choice, t("error.save")),
		success: t("toast.slotAssigned"),
		failure: t("error.save"),
		inline: true,
		invalidate: [apiKeysKeys.all],
		onSuccess: onClose,
		onError: (saveError) => setError(errorText(site, saveError, t("error.save"))),
	});
	const saving = assign.isPending;
	const save = () => {
		setError(null);
		assign.mutate(current);
	};
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent data-testid="api-key-slot-dialog">
				<form
					className="grid gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t("slot.dialog.title", { label: slot.label })}</DialogTitle>
						<DialogDescription>{t("slot.dialog.description")}</DialogDescription>
					</DialogHeader>
					<ApiKeyField value={current} onChange={setChoice} baseName={slot.service} />
					{error && <FormFieldError>{error}</FormFieldError>}
					<DialogFormFooter
						onCancel={onClose}
						busy={saving}
						disabled={!choiceReady(current)}
						submitLabel={t("slot.dialog.confirm")}
					/>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function KeyDialog({
	editing,
	taken,
	onClose,
}: {
	editing: Editing;
	taken: readonly ApiKeyView[];
	onClose: () => void;
}) {
	const t = useTranslator(apiKeysMessages);
	const site = useSite();
	const nameId = useId();
	const valueId = useId();
	const key = editing.mode === "add" ? null : editing.key;
	const [name, setName] = useState(key?.name ?? "");
	const [value, setValue] = useState("");
	const [error, setError] = useState<string | null>(null);
	const needsName = editing.mode !== "replace";
	const needsValue = editing.mode !== "rename";
	const nameTaken = needsName && taken.some((item) => item.name.toLowerCase() === name.trim().toLowerCase());
	const ready = (!needsName || (name.trim() !== "" && !nameTaken)) && (!needsValue || value.trim() !== "");

	const saveKey = useCmsMutation({
		// biome-ignore lint/suspicious/noConfusingVoidType: a mutation without variables, so `mutate()` takes no argument
		fn: (_: void, { site }) => {
			if (!key) return createApiKey(site, { name: name.trim(), value: value.trim() }, t("error.save"));
			return updateApiKey(
				site,
				key.id,
				{
					expectedVersion: key.version,
					...(editing.mode === "rename" ? { name: name.trim() } : { value: value.trim() }),
				},
				t("error.save"),
			);
		},
		success: t(editing.mode === "add" ? "toast.added" : editing.mode === "rename" ? "toast.renamed" : "toast.replaced"),
		failure: t("error.save"),
		inline: true,
		// A failed save can mean the key changed meanwhile, so the list is refetched either way.
		invalidate: [apiKeysKeys.all],
		onSuccess: onClose,
		onError: (saveError) => setError(errorText(site, saveError, t("error.save"))),
	});
	const saving = saveKey.isPending;

	const save = () => {
		if (!ready || saving) return;
		setError(null);
		saveKey.mutate();
	};

	const title =
		editing.mode === "add"
			? t("dialog.add.title")
			: editing.mode === "rename"
				? t("dialog.rename.title")
				: t("dialog.replace.title", { name: editing.key.name });
	const description: ReactNode =
		editing.mode === "add"
			? t("dialog.add.description")
			: editing.mode === "rename"
				? t("dialog.rename.description")
				: t("dialog.replace.description");
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent data-testid="api-key-dialog">
				<form
					className="grid gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					{needsName && (
						<Labeled label={t("field.name")} htmlFor={nameId}>
							<Input
								id={nameId}
								value={name}
								autoComplete="off"
								placeholder={t("field.namePlaceholder")}
								aria-invalid={nameTaken ? true : undefined}
								onChange={(event) => setName(event.target.value)}
							/>
							{nameTaken && <FormFieldError className="text-monti-caption">{t("field.nameTaken")}</FormFieldError>}
						</Labeled>
					)}
					{needsValue && (
						<Labeled label={t("field.value")} htmlFor={valueId}>
							<Input
								id={valueId}
								type="password"
								autoComplete="off"
								className="font-mono"
								value={value}
								placeholder={t("field.valuePlaceholder")}
								onChange={(event) => setValue(event.target.value)}
							/>
						</Labeled>
					)}
					{error && <FormFieldError>{error}</FormFieldError>}
					<DialogFormFooter
						onCancel={onClose}
						busy={saving}
						disabled={!ready}
						submitLabel={t(
							editing.mode === "add"
								? "dialog.add.confirm"
								: editing.mode === "rename"
									? "dialog.rename.confirm"
									: "dialog.replace.confirm",
						)}
					/>
				</form>
			</DialogContent>
		</Dialog>
	);
}
