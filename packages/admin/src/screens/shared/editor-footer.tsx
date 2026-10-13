import { useTranslator } from "@monti-cms/core/client";
import type { ReactNode } from "react";
import { commonMessages } from "../../lib/common-messages";
import { cn } from "../../lib/utils/cn";
import { Button } from "../../ui/button";
import { FieldError } from "../../ui/field";

/**
 * The action row under an edit form: the error of the last attempt, Save (enabled while there are unsaved changes), Cancel (when `onCancel` is
 * given: a new item can be abandoned), anything extra, and Delete at the far end (when `onDelete` is given). Pair it with `useDraftEditor`.
 */
export function EditorFooter({
	dirty,
	saving = false,
	deleting = false,
	canSave = true,
	error,
	onSave,
	onCancel,
	onDelete,
	saveLabel,
	saveIcon,
	align = "start",
	children,
	className,
}: {
	dirty: boolean;
	saving?: boolean;
	deleting?: boolean;
	/** The form is complete enough to save (a name is filled in). */
	canSave?: boolean;
	error?: string | null;
	/** Called on the Save button; with a `<form onSubmit>` around the footer, pass `submit` instead. */
	onSave?: () => void;
	onCancel?: () => void;
	onDelete?: () => void;
	saveLabel?: string;
	saveIcon?: ReactNode;
	align?: "start" | "end";
	/** Extra buttons between Cancel and Delete. */
	children?: ReactNode;
	className?: string;
}) {
	const t = useTranslator(commonMessages);
	const busy = saving || deleting;
	return (
		<div className={cn("space-y-2", className)}>
			{error && <FieldError className="whitespace-pre-wrap">{error}</FieldError>}
			<div className={cn("flex flex-wrap items-center gap-2", align === "end" && "justify-end")}>
				<Button type={onSave ? "button" : "submit"} size="sm" disabled={busy || !dirty || !canSave} onClick={onSave}>
					{saveIcon}
					{saving ? t("saving") : (saveLabel ?? t("save"))}
				</Button>
				{onCancel && (
					<Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>
						{t("cancel")}
					</Button>
				)}
				{children}
				{onDelete && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						disabled={busy}
						className={cn(
							"text-cms-destructive hover:bg-cms-destructive-soft hover:text-cms-destructive",
							align === "start" && "ml-auto",
						)}
						onClick={onDelete}
					>
						{deleting ? t("deleting") : t("delete")}
					</Button>
				)}
			</div>
		</div>
	);
}
