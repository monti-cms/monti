import type * as React from "react";
import { cn } from "./cn";
import { IconButtonContext } from "./icon-button";

/**
 * The saved keys of a tools page (API keys), as lines and space, no bordered table: a `border-muted` line above the first row and under every row.
 * Its rows are {@link KeyRow}s, or a {@link KeyListEmpty} while there is none.
 */
function KeyList({ className, ...props }: React.ComponentProps<"div">) {
	return <div role="list" data-slot="key-list" className={cn("flex flex-col", className)} {...props} />;
}

/**
 * One saved key: its name (14px 500, ink) with what identifies it after it in mono (`identifier`: the key's last characters "sk-or-…8e42", an address
 * "localhost:11434"), a line under it saying where it is used (`meta`, 13px on an 18px line, subtle; `danger` when the service refused it), then at the end its state
 * (`status`, an `EntryStatus`; a taken key's name is muted, green on the dark ground) with a fix 8px before it (`action`, a small pill), and the row's ⋯ (`more`) in a 32px column. At least 60px, 10px above and
 * below; a long name wraps, it is not cut.
 */
function KeyRow({
	name,
	identifier,
	meta,
	metaTone = "subtle",
	status,
	action,
	more,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	name: React.ReactNode;
	identifier?: React.ReactNode;
	meta?: React.ReactNode;
	metaTone?: "subtle" | "danger";
	status?: React.ReactNode;
	action?: React.ReactNode;
	more?: React.ReactNode;
}) {
	return (
		<div
			role="listitem"
			data-slot="key-row"
			className={cn(
				"grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto_32px] items-center gap-x-monti-16 border-monti-muted border-b py-monti-10 first:border-t",
				className,
			)}
			{...props}
		>
			<div className="min-w-0">
				<div className="flex flex-wrap items-baseline gap-x-monti-10">
					<span className="font-medium text-monti-body text-monti-default">{name}</span>
					{identifier && (
						<span data-slot="key-row-identifier" className="font-mono text-monti-caption text-monti-faint">
							{identifier}
						</span>
					)}
				</div>
				{meta && (
					<div
						className={cn(
							"mt-monti-2 font-normal text-monti-label",
							metaTone === "danger" ? "text-monti-danger" : "text-monti-subtle",
						)}
					>
						{meta}
					</div>
				)}
			</div>
			{/* Its status at the normal weight; a key the service took ("확인됨", a quiet `published` status) says so in the muted ink, and in the success green on the dark ground. */}
			<div className="flex items-center gap-monti-8 [&_[data-slot=entry-status][data-status=published]]:text-monti-muted monti-dark:[&_[data-slot=entry-status][data-status=published]]:text-monti-success [&_[data-slot=entry-status]]:font-normal">
				{action}
				{status}
			</div>
			{/* ⋯는 상자가 아니라 보이는 점의 끝이 목록의 선이 끝나는 곳에 선다(`IconButton edge="end"`). */}
			<div className="flex justify-end [&_[data-slot=icon-button]]:text-monti-faint">
				<IconButtonContext value={{ edge: "end" }}>{more}</IconButtonContext>
			</div>
		</div>
	);
}

/** What a {@link KeyList} says while it holds no key: a line in ink (14px 500) and one quiet sentence under it (13px on an 18px line, at most 440px). */
function KeyListEmpty({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
	return (
		<div data-slot="key-list-empty" className="pt-monti-4 pb-monti-8">
			<p className="m-0 font-medium text-monti-body text-monti-default">{title}</p>
			{children && (
				<p className="m-0 mt-monti-4 max-w-[440px] font-normal text-monti-label text-monti-subtle">{children}</p>
			)}
		</div>
	);
}

/**
 * A setting picked for one use, as a row of a section (the model of the assistant and of the quick tasks): its name (14px 500) and what it is for
 * under it (12px, faint) in a 160px column, 16px, then the control (a `Select` that takes the rest). At least 52px, a `border-muted` line above the first
 * and under each.
 */
function ControlRow({
	label,
	description,
	labelId,
	children,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	label: React.ReactNode;
	description?: React.ReactNode;
	/** Goes on the name, for the control's `aria-labelledby`. */
	labelId?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			data-slot="control-row"
			className={cn(
				"grid min-h-[52px] grid-cols-[160px_minmax(0,1fr)] items-center gap-x-monti-16 border-monti-muted border-b first:border-t",
				className,
			)}
			{...props}
		>
			<div className="min-w-0">
				<div id={labelId} className="font-medium text-monti-body text-monti-default">
					{label}
				</div>
				{description && <div className="mt-px text-monti-caption text-monti-faint">{description}</div>}
			</div>
			<div className="min-w-0">{children}</div>
		</div>
	);
}

/** A service's mark where it has no logo: its first letter in a 20px square (`radius-sm`, the muted ground, 11px 600). */
function LetterMark({ children, className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			aria-hidden
			data-slot="letter-mark"
			className={cn(
				"inline-flex size-5 shrink-0 items-center justify-center rounded-monti-sm bg-monti-muted font-semibold text-monti-micro text-monti-muted",
				className,
			)}
			{...props}
		>
			{children}
		</span>
	);
}

export { ControlRow, KeyList, KeyListEmpty, KeyRow, LetterMark };
