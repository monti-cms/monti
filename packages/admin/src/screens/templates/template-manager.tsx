"use client";

import { cmsApiUrl, createTranslator } from "@monti-cms/core/client";
import type { BodyTemplate } from "@monti-cms/core/runtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutTemplate, Plus, SquarePen, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CmsEditor } from "../../editor/tiptap-editor";
import { cn } from "../../lib/utils/cn";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty";
import { Input } from "../../ui/input";
import { Skeleton } from "../../ui/skeleton";
import { cmsFetch, errorText } from "../admin-api";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { AdminShell } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { formatDateOnly } from "../shared/format-date";
import { OPEN_ITEM } from "../shared/side-panel";
import { templatesMessages } from "./messages";

const t = createTranslator(templatesMessages);

const TEMPLATES_KEY = ["cms", "templates"] as const;

/** Initial body of a new template. */
const NEW_TEMPLATE_MDX = t("newMdx");

export function TemplateManager() {
	const queryClient = useQueryClient();
	// If there is a cache, render it right away and refetch in the background. Placeholders show only when there is no cache.
	const templatesQuery = useQuery({
		queryKey: TEMPLATES_KEY,
		queryFn: async ({ signal }) =>
			(
				await cmsFetch<{ items?: BodyTemplate[] }>(cmsApiUrl("/v1/templates"), {
					signal,
					fallback: t("list.loadFailed"),
				})
			).items ?? [],
	});
	const templates = templatesQuery.data ?? [];
	const error =
		templatesQuery.error && !templatesQuery.data ? errorText(templatesQuery.error, t("list.loadFailed")) : null;

	// The template open in the edit panel (a new template has no id) and the values being edited.
	const [activeTemplate, setActiveTemplate] = useState<Partial<BodyTemplate> | null>(null);
	const [editName, setEditName] = useState("");
	const [editMdx, setEditMdx] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const { confirm, confirmDiscard, dialog } = useConfirm();

	/** Whether the name or body of the open template was changed. */
	const isDirty =
		activeTemplate !== null && (editName !== (activeTemplate.name ?? "") || editMdx !== (activeTemplate.mdx ?? ""));

	/** Refetches the list in the background. Rows currently visible stay as they are. */
	const invalidateTemplates = () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });

	const show = (template: Partial<BodyTemplate> | null) => {
		setActiveTemplate(template);
		setEditName(template?.name ?? "");
		setEditMdx(template?.mdx ?? "");
		setSaveError(null);
	};

	/** Opens another template. If there are unsaved changes, asks first whether to discard them. */
	const openTemplate = async (template: BodyTemplate) => {
		if (template.id === activeTemplate?.id) return;
		if (await confirmDiscard(isDirty)) show(template);
	};

	const openNew = async () => {
		if (await confirmDiscard(isDirty)) show({ name: "", mdx: NEW_TEMPLATE_MDX });
	};

	const closeEditor = async () => {
		if (await confirmDiscard(isDirty)) show(null);
	};

	const handleSave = async () => {
		if (!activeTemplate || isSaving) return;
		if (!editName.trim()) {
			setSaveError(t("edit.nameRequired"));
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			if (activeTemplate.id) {
				const updated = await cmsFetch<BodyTemplate>(cmsApiUrl(`/v1/templates/${activeTemplate.id}`), {
					method: "PATCH",
					json: { name: editName.trim(), mdx: editMdx, expectedVersion: activeTemplate.version },
					fallback: t("common.saveFailed"),
				});
				show(updated);
				queryClient.setQueryData<BodyTemplate[]>(TEMPLATES_KEY, (current) =>
					current?.map((item) => (item.id === updated.id ? updated : item)),
				);
			} else {
				const created = await cmsFetch<BodyTemplate>(cmsApiUrl("/v1/templates"), {
					method: "POST",
					json: { name: editName.trim(), mdx: editMdx },
					fallback: t("common.saveFailed"),
				});
				// Keep the created template open.
				show(created);
				queryClient.setQueryData<BodyTemplate[]>(TEMPLATES_KEY, (current) =>
					current && !current.some((item) => item.id === created.id) ? [created, ...current] : current,
				);
			}
			toast.success(t("common.saved"));
			void invalidateTemplates();
		} catch (err) {
			setSaveError(errorText(err, t("common.saveFailed")));
		} finally {
			setIsSaving(false);
		}
	};

	// Save with ⌘S or Ctrl+S (only while the edit panel is open). The function is kept in a ref so it saves the latest values.
	const saveRef = useRef(handleSave);
	saveRef.current = handleSave;
	const isEditing = activeTemplate !== null;
	useEffect(() => {
		if (!isEditing) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing) return;
			if (event.key.toLowerCase() !== "s") return;
			event.preventDefault();
			void saveRef.current();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isEditing]);

	const deleteTemplate = async (template: BodyTemplate) => {
		// Remove from the list first, then send the request. On failure, revert; when done, sync to the server value.
		await queryClient.cancelQueries({ queryKey: TEMPLATES_KEY });
		const previous = queryClient.getQueryData<BodyTemplate[]>(TEMPLATES_KEY);
		queryClient.setQueryData<BodyTemplate[]>(TEMPLATES_KEY, (current) =>
			current?.filter((item) => item.id !== template.id),
		);
		if (activeTemplate?.id === template.id) show(null);
		try {
			await cmsFetch(cmsApiUrl(`/v1/templates/${template.id}?expectedVersion=${template.version}`), {
				method: "DELETE",
				fallback: t("delete.failed"),
			});
			toast.success(t("delete.done", { name: template.name }));
		} catch (err) {
			if (previous) queryClient.setQueryData(TEMPLATES_KEY, previous);
			toast.error(errorText(err, t("delete.failed")));
		} finally {
			void invalidateTemplates();
		}
	};

	const requestDelete = async (template: BodyTemplate) => {
		const ok = await confirm({
			title: t("delete.title"),
			description: t("delete.ask", { name: template.name }),
			confirmLabel: t("common.delete"),
			destructive: true,
		});
		if (ok) await deleteTemplate(template);
	};

	/** Right-click and `⋯` menu of a template list row. */
	const templateMenu = (template: BodyTemplate): MenuAction[] => [
		{ kind: "item", label: t("common.open"), icon: SquarePen, onSelect: () => void openTemplate(template) },
		{ kind: "separator" },
		{
			kind: "item",
			label: t("common.delete"),
			icon: Trash2,
			shortcut: "Del",
			destructive: true,
			onSelect: () => void requestDelete(template),
		},
	];

	return (
		<AdminShell
			title={t("title")}
			count={templatesQuery.data ? templates.length : undefined}
			sidebar={{ activeNav: "templates" }}
			headerActions={
				<Button type="button" size="sm" onClick={() => void openNew()}>
					<Plus aria-hidden />
					{t("common.add")}
				</Button>
			}
		>
			{error && (
				<Alert variant="danger" className="mx-5 mt-3 flex w-auto items-center justify-between">
					<AlertDescription className="col-start-auto">{error}</AlertDescription>
					<Button type="button" variant="outline" size="xs" onClick={() => void templatesQuery.refetch()}>
						{t("common.retry")}
					</Button>
				</Alert>
			)}
			<div className="flex min-h-0 flex-1 overflow-hidden">
				<div className="flex w-72 shrink-0 flex-col border-r">
					<ul className="flex-1 divide-y overflow-y-auto" aria-label={t("list.label")}>
						{templatesQuery.isPending
							? Array.from({ length: 3 }, (_, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: placeholder
									<li key={index} className="p-4" aria-hidden>
										<Skeleton className="h-10 w-full" />
									</li>
								))
							: templates.length === 0
								? !error && <li className="p-8 text-center text-cms-muted-foreground text-xs">{t("list.empty")}</li>
								: templates.map((row) => {
										const isSelected = activeTemplate?.id === row.id;
										return (
											<ActionContextMenu
												key={row.id}
												actions={templateMenu(row)}
												trigger={
													<li
														className={cn(
															"group flex items-center justify-between gap-2 px-3 py-2 transition-colors",
															isSelected ? OPEN_ITEM : "hover:bg-cms-accent/50",
														)}
													/>
												}
											>
												<Button
													variant="ghost"
													type="button"
													aria-current={isSelected ? "true" : undefined}
													onClick={() => void openTemplate(row)}
													onKeyDown={(event) => {
														if (event.key === "Delete") {
															event.preventDefault();
															void requestDelete(row);
														}
													}}
													className="h-auto min-w-0 flex-1 flex-col items-start gap-1.5 px-1 py-1 text-left font-normal hover:bg-transparent"
												>
													<span className="truncate font-medium text-sm">{row.name}</span>
													<span className="text-[11px] text-cms-muted-foreground">{formatDateOnly(row.updatedAt)}</span>
												</Button>
												<MoreActionsButton
													actions={templateMenu(row)}
													label={t("list.itemActions", { name: row.name })}
												/>
											</ActionContextMenu>
										);
									})}
					</ul>
				</div>

				<div className="flex flex-1 flex-col overflow-hidden">
					{activeTemplate ? (
						// The body editor also contains buttons and inputs, so it is not wrapped in a <form>. Enter in the name field and ⌘S save.
						<section
							aria-label={activeTemplate.id ? t("edit.label") : t("edit.addLabel")}
							className="flex h-full flex-1 flex-col overflow-hidden"
						>
							<div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
								<Input
									type="text"
									aria-label={t("edit.nameLabel")}
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									onKeyDown={(event) => {
										// Enter during Korean IME composition ends the character. Do not save.
										if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
										event.preventDefault();
										void handleSave();
									}}
									placeholder={t("edit.nameLabel")}
									className="h-8 min-w-0 max-w-2xl flex-1"
								/>
								<div className="flex items-center gap-2">
									<Button type="button" variant="outline" size="sm" onClick={() => void closeEditor()}>
										{t("common.cancel")}
									</Button>
									<Button type="button" size="sm" disabled={isSaving} onClick={() => void handleSave()}>
										{isSaving ? t("common.saving") : t("common.save")}
									</Button>
								</div>
							</div>
							{saveError && (
								<p role="alert" className="border-b bg-cms-destructive/10 px-6 py-2 text-cms-destructive text-xs">
									{saveError}
								</p>
							)}
							<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
								<CmsEditor content={editMdx} onChange={(next) => setEditMdx(next)} />
							</div>
						</section>
					) : (
						<Empty className="flex-1">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<LayoutTemplate aria-hidden />
								</EmptyMedia>
								<EmptyTitle>{t("edit.empty")}</EmptyTitle>
							</EmptyHeader>
							<EmptyContent>
								<Button type="button" size="sm" onClick={() => void openNew()}>
									<Plus aria-hidden />
									{t("common.add")}
								</Button>
							</EmptyContent>
						</Empty>
					)}
				</div>
			</div>
			{dialog}
		</AdminShell>
	);
}
