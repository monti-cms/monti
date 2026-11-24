import type * as React from "react";
import { cn } from "./cn";

/**
 * The saved keys of a tools page (API keys), as lines and space, no bordered table: a `border-muted` line above the first row and under every row.
 * Its rows are {@link KeyRow}s, or a {@link KeyListEmpty} while there is none.
 */
function KeyList({ className, ...props }: React.ComponentProps<"div">) {
	return <div role="list" data-slot="key-list" className={cn("flex flex-col", className)} {...props} />;
}

/**
 * 저장된 키 하나: 이름(14px 500, 잉크)과 그 뒤 mono로 키를 알아보는 값(`identifier`: 키의 끝 "sk-or-…8e42", 주소 "localhost:11434"), 그 아래 쓰는 곳 한 줄
 * (`meta`, 13px · 18px 줄, subtle. 서비스가 키를 받지 않았으면 `danger`), 끝에 상태(`status`, `EntryStatus`. 받아들여진 키는 흐린 잉크, 어두운 바탕에서 초록)와
 * 그 앞 8px의 고칠 단추(`action`, 작은 알약), 그리고 40px 열의 ⋯(`more`): 목록 행의 ⋯처럼 상자가 끝선에서 12px 안에서 끝나고 가리킨 바탕도 선을 넘지 않는다
 * (2026-11-24 소유자). 적어도 60px, 위아래 10px. 긴 이름은 자르지 않고 줄을 바꾼다.
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
				"grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto_40px] items-center gap-x-monti-16 border-monti-muted border-b py-monti-10 first:border-t",
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
			<div className="flex justify-end pr-monti-12 [&_[data-slot=icon-button]]:text-monti-faint">{more}</div>
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

/**
 * A service's mark where it has no logo: its first letter in a 20px square (`radius-sm`, the muted ground, 11px 600). `person`: a person's mark where
 * there is no picture (the signed-in account): a 32px circle on the selected ground, 13px 600 in the muted ink.
 */
function LetterMark({
	person = false,
	children,
	className,
	...props
}: React.ComponentProps<"span"> & { person?: boolean }) {
	return (
		<span
			aria-hidden
			data-slot="letter-mark"
			className={cn(
				"inline-flex shrink-0 items-center justify-center font-semibold",
				person
					? "size-8 rounded-monti-full bg-monti-selected text-monti-label text-monti-muted"
					: "size-5 rounded-monti-sm bg-monti-muted text-monti-micro text-monti-muted",
				className,
			)}
			{...props}
		>
			{children}
		</span>
	);
}

export { ControlRow, KeyList, KeyListEmpty, KeyRow, LetterMark };
