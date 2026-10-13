"use client";

import {
	type ApiKeyList,
	type ApiKeySlotView,
	type ApiKeyView,
	cmsApiUrl,
	useSite,
	useTranslator,
} from "@monti-cms/core/client";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, RefreshCw, Trash2, Unplug } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty";
import { FieldError } from "../../ui/field";
import { Input } from "../../ui/input";
import { Skeleton } from "../../ui/skeleton";
import { cmsFetch, errorText } from "../admin-api";
import { Labeled } from "../schema/controls";
import { Section } from "../schema/section";
import { type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { type ApiKeyChoice, ApiKeyField, choiceReady } from "./api-key-field";
import { API_KEYS_KEY, useApiKeys } from "./api-keys-api";
import { apiKeysMessages } from "./messages";

type Editing = { mode: "add" } | { mode: "rename" | "replace"; key: ApiKeyView };

/** Assigns a key to a plugin slot, or clears it (`none`). A typed key is saved in the same request. */
async function putSlot(site: ReturnType<typeof useSite>, plugin: string, slot: string, key: unknown, fallback: string) {
	return cmsFetch(site, cmsApiUrl("/v1/api-keys/slots"), { method: "PUT", json: { plugin, slot, key }, fallback });
}

/** Settings → API keys: one card with a row per key, and the dialogs to add, rename, replace and delete. */
export function ApiKeysSettings() {
	const t = useTranslator(apiKeysMessages);
	const site = useSite();
	const query = useApiKeys();
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState<Editing | null>(null);
	const [slotEditing, setSlotEditing] = useState<ApiKeySlotView | null>(null);
	const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
	const refresh = () => queryClient.invalidateQueries({ queryKey: API_KEYS_KEY });
	const list: ApiKeyList | undefined = query.data;

	const askDelete = (key: ApiKeyView) => {
		const used = key.uses.length > 0;
		setConfirmRequest({
			title: t("delete.title", { name: key.name }),
			description: used ? (
				<div className="flex flex-col gap-2">
					<p>{t("delete.usedDescription", { count: key.uses.length })}</p>
					<ul className="list-disc pl-5" data-testid="delete-dependents">
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
			onConfirm: async () => {
				try {
					await cmsFetch(
						site,
						cmsApiUrl(`/v1/api-keys/${key.id}?expectedVersion=${key.version}${used ? "&force=true" : ""}`),
						{ method: "DELETE", fallback: t("error.delete") },
					);
					toast.success(t("toast.deleted"));
				} catch (error) {
					toast.error(errorText(site, error, t("error.delete")));
				}
				await refresh();
			},
		});
	};

	const clearSlot = async (plugin: string, slot: string, label: string) => {
		try {
			await putSlot(site, plugin, slot, { use: "none" }, t("error.save"));
			toast.success(t("toast.slotCleared", { label }));
		} catch (error) {
			toast.error(errorText(site, error, t("error.save")));
		}
		await refresh();
	};

	const rowMenu = (key: ApiKeyView): MenuAction[] => [
		{ kind: "item", label: t("menu.rename"), icon: Pencil, onSelect: () => setEditing({ mode: "rename", key }) },
		{ kind: "item", label: t("menu.replace"), icon: RefreshCw, onSelect: () => setEditing({ mode: "replace", key }) },
		...key.slots.map(
			(use): MenuAction => ({
				kind: "item",
				label: t("menu.clearSlot", { label: use.label }),
				icon: Unplug,
				onSelect: () => void clearSlot(use.plugin, use.ref, use.label),
			}),
		),
		{ kind: "separator" },
		{ kind: "item", label: t("menu.delete"), icon: Trash2, destructive: true, onSelect: () => askDelete(key) },
	];

	return (
		<div
			className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 py-6 lg:px-10 lg:py-9"
			data-testid="api-keys-settings"
		>
			{list && !list.secretsAvailable && (
				<Alert variant="danger" layout="stack">
					<AlertTitle>{t("secret.title")}</AlertTitle>
					<AlertDescription>{t("secret.description")}</AlertDescription>
				</Alert>
			)}
			<Section wide card={false} title={t("title")} description={t("description")} note={t("note")}>
				<div className="overflow-hidden rounded-lg border bg-cms-card">
					<div className="flex items-center justify-between gap-3 border-b px-4 py-3">
						<span className="text-cms-muted-foreground text-sm">
							{list
								? [
										t("count.keys", { count: list.items.length }),
										...(list.slots.some((slot) => !slot.key)
											? [t("count.needed", { count: list.slots.filter((slot) => !slot.key).length })]
											: []),
									].join(" · ")
								: "\u00a0"}
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={!list?.secretsAvailable}
							onClick={() => setEditing({ mode: "add" })}
						>
							<Plus aria-hidden />
							{t("add")}
						</Button>
					</div>
					<KeyRows
						query={query}
						onAdd={() => setEditing({ mode: "add" })}
						menu={rowMenu}
						onAssign={setSlotEditing}
						onRetry={() => void query.refetch()}
					/>
				</div>
			</Section>
			{editing && (
				<KeyDialog
					key={editing.mode === "add" ? "add" : `${editing.mode}:${editing.key.id}`}
					editing={editing}
					taken={(list?.items ?? []).filter((item) => editing.mode === "add" || item.id !== editing.key.id)}
					onClose={() => setEditing(null)}
					onSaved={() => void refresh()}
				/>
			)}
			{slotEditing && (
				<SlotDialog
					key={`${slotEditing.plugin}:${slotEditing.slot}`}
					slot={slotEditing}
					onClose={() => setSlotEditing(null)}
					onSaved={() => void refresh()}
				/>
			)}
			<ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
		</div>
	);
}

function KeyRows({
	query,
	onAdd,
	menu,
	onAssign,
	onRetry,
}: {
	query: ReturnType<typeof useApiKeys>;
	onAdd: () => void;
	menu: (key: ApiKeyView) => MenuAction[];
	onAssign: (slot: ApiKeySlotView) => void;
	onRetry: () => void;
}) {
	const t = useTranslator(apiKeysMessages);
	const site = useSite();
	const list = query.data;
	if (!list) {
		if (query.error) {
			return (
				<Alert variant="danger" className="m-3 flex w-auto items-center justify-between gap-3">
					<AlertDescription className="col-start-auto">
						{errorText(site, query.error, t("load.failed"))}
					</AlertDescription>
					<Button type="button" variant="outline" size="xs" onClick={onRetry}>
						{t("load.retry")}
					</Button>
				</Alert>
			);
		}
		return <Skeleton className="m-4 h-12" />;
	}
	const emptySlots = list.slots.filter((slot) => !slot.key);
	if (list.items.length === 0 && list.slots.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<KeyRound aria-hidden />
					</EmptyMedia>
					<EmptyTitle>{t("empty.title")}</EmptyTitle>
				</EmptyHeader>
				<p className="text-cms-muted-foreground text-sm">{t("empty.description")}</p>
				<EmptyContent>
					<Button type="button" size="sm" disabled={!list.secretsAvailable} onClick={onAdd}>
						<Plus aria-hidden />
						{t("add")}
					</Button>
				</EmptyContent>
			</Empty>
		);
	}
	return (
		<ul className="divide-y" aria-label={t("title")}>
			{list.items.map((key) => (
				<li key={key.id} className="flex items-center gap-3.5 px-4 py-3" data-testid={`api-key-${key.name}`}>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="truncate font-medium text-sm">{key.name}</span>
							{!key.readable && (
								<Badge variant="destructive" title={t("row.unreadableHint")}>
									{t("row.unreadable")}
								</Badge>
							)}
						</div>
						<p className="mt-0.5 truncate text-cms-muted-foreground text-xs">
							{!key.readable
								? t("row.unreadableHint")
								: key.uses.length > 0
									? t("row.usedBy", { uses: key.uses.map((use) => use.label).join(", ") })
									: t("row.unused")}
						</p>
					</div>
					<span
						className="shrink-0 font-mono text-cms-muted-foreground text-xs"
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
					className="flex items-center gap-3.5 px-4 py-3"
					data-testid={`api-key-slot-${slot.plugin}-${slot.slot}`}
				>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="truncate font-medium text-sm">{slot.label}</span>
							<span className="text-cms-muted-foreground text-xs">{t("slot.empty")}</span>
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
function SlotDialog({ slot, onClose, onSaved }: { slot: ApiKeySlotView; onClose: () => void; onSaved: () => void }) {
	const t = useTranslator(apiKeysMessages);
	const site = useSite();
	const query = useApiKeys();
	const hasKeys = (query.data?.items.length ?? 0) > 0;
	const [choice, setChoice] = useState<ApiKeyChoice | null>(null);
	const current: ApiKeyChoice =
		choice ?? (hasKeys ? { use: "saved", keyId: query.data?.items[0]?.id ?? "" } : { use: "new", value: "" });
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const save = async () => {
		setSaving(true);
		setError(null);
		try {
			await putSlot(site, slot.plugin, slot.slot, current, t("error.save"));
			toast.success(t("toast.slotAssigned"));
			onSaved();
			onClose();
		} catch (saveError) {
			setError(errorText(site, saveError, t("error.save")));
		} finally {
			setSaving(false);
		}
	};
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent data-testid="api-key-slot-dialog">
				<form
					className="grid gap-5"
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
					{error && (
						<p role="alert" className="text-cms-destructive text-xs">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							{t("dialog.cancel")}
						</Button>
						<Button type="submit" disabled={!choiceReady(current) || saving}>
							{saving ? t("dialog.saving") : t("slot.dialog.confirm")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function KeyDialog({
	editing,
	taken,
	onClose,
	onSaved,
}: {
	editing: Editing;
	taken: readonly ApiKeyView[];
	onClose: () => void;
	onSaved: () => void;
}) {
	const t = useTranslator(apiKeysMessages);
	const site = useSite();
	const nameId = useId();
	const valueId = useId();
	const key = editing.mode === "add" ? null : editing.key;
	const [name, setName] = useState(key?.name ?? "");
	const [value, setValue] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const needsName = editing.mode !== "replace";
	const needsValue = editing.mode !== "rename";
	const nameTaken = needsName && taken.some((item) => item.name.toLowerCase() === name.trim().toLowerCase());
	const ready = (!needsName || (name.trim() !== "" && !nameTaken)) && (!needsValue || value.trim() !== "");

	const save = async () => {
		if (!ready || saving) return;
		setSaving(true);
		setError(null);
		try {
			if (key) {
				await cmsFetch(site, cmsApiUrl(`/v1/api-keys/${key.id}`), {
					method: "PATCH",
					json: {
						expectedVersion: key.version,
						...(editing.mode === "rename" ? { name: name.trim() } : { value: value.trim() }),
					},
					fallback: t("error.save"),
				});
			} else {
				await cmsFetch(site, cmsApiUrl("/v1/api-keys"), {
					method: "POST",
					json: { name: name.trim(), value: value.trim() },
					fallback: t("error.save"),
				});
			}
			toast.success(
				t(editing.mode === "add" ? "toast.added" : editing.mode === "rename" ? "toast.renamed" : "toast.replaced"),
			);
			onSaved();
			onClose();
		} catch (saveError) {
			setError(errorText(site, saveError, t("error.save")));
			onSaved();
		} finally {
			setSaving(false);
		}
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
					className="grid gap-5"
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
							{nameTaken && <FieldError className="text-xs">{t("field.nameTaken")}</FieldError>}
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
					{error && (
						<p role="alert" className="text-cms-destructive text-xs">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							{t("dialog.cancel")}
						</Button>
						<Button type="submit" disabled={!ready || saving}>
							{saving
								? t("dialog.saving")
								: t(
										editing.mode === "add"
											? "dialog.add.confirm"
											: editing.mode === "rename"
												? "dialog.rename.confirm"
												: "dialog.replace.confirm",
									)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
