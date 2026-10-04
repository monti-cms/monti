"use client";

import { cmsApiUrl, createTranslator } from "@monti-cms/core/client";
import { type FormEvent, useEffect, useId, useState } from "react";
import { cn } from "../lib/utils/cn";
import { MEDIA_NOT_CONFIGURED } from "../screens/api-error-message";
import { useAdminFeatures } from "../screens/shared/admin-features";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../ui/spinner";
import { Switch } from "../ui/switch";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import { submitOnEnter } from "./link-form";
import { editorMessages } from "./messages";
import { formatBytes, type PreparedUpload, prepareUpload, uploadImageFile } from "./upload-helper";

const t = createTranslator(editorMessages);

/** 설명이 필요한 이미지에 대체 텍스트가 없을 때의 안내. 넣기 대화 상자와 이미지 설정이 같이 쓴다. */
export const ALT_REQUIRED_MESSAGE = t("imageDialog.altRequired");

export interface ImageInsertion {
	mediaId: string;
	alt: string;
	decorative: boolean;
	caption: string;
	/** 미리보기용 공개 주소. 아직 없으면 `null`. */
	publicUrl: string | null;
}

interface LibraryItem {
	id: string;
	filename: string;
	publicUrl: string | null;
	width: number | null;
	height: number | null;
	defaultAlt: string;
	defaultCaption: string;
}

interface ImageInsertDialogProps {
	open: boolean;
	/** 붙여넣기·끌어놓기로 들어온 파일. 있으면 업로드 탭으로 연다. */
	initialFile: File | null;
	onClose: () => void;
	onInsert: (image: ImageInsertion) => void;
	/** `pick`은 본문에 넣지 않고 이미지 하나만 고른다(미디어 필드). 대체 텍스트·캡션을 묻지 않는다. */
	mode?: "insert" | "pick";
	title?: string;
}

/**
 * 이미지 삽입(§7.1). 새 파일 업로드(원본 유지 기본, 웹용 최적화 선택) 또는 라이브러리 재사용.
 * 라이브러리의 기본 alt·caption은 삽입할 때 복사한다(§7.3). 설명이 필요한 이미지는 alt가 있어야 한다.
 */
export function ImageInsertDialog({
	open,
	initialFile,
	onClose,
	onInsert,
	mode = "insert",
	title = t("imageDialog.title"),
}: ImageInsertDialogProps) {
	const picking = mode === "pick";
	const { media } = useAdminFeatures();
	const altId = useId();
	const altErrorId = useId();
	const captionId = useId();
	const searchId = useId();
	const optimizeId = useId();
	const decorativeId = useId();
	const [tab, setTab] = useState<"upload" | "library">("upload");
	const [file, setFile] = useState<File | null>(null);
	const [optimize, setOptimize] = useState(false);
	const [prepared, setPrepared] = useState<PreparedUpload | null>(null);
	const [picked, setPicked] = useState<LibraryItem | null>(null);
	const [alt, setAlt] = useState("");
	const [caption, setCaption] = useState("");
	const [decorative, setDecorative] = useState(false);
	/** 대체 텍스트 칸을 건드렸거나 넣기를 눌렀으면 빈 대체 텍스트를 오류로 보인다. */
	const [altTouched, setAltTouched] = useState(false);
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [library, setLibrary] = useState<LibraryItem[]>([]);
	const [isLibraryLoading, setIsLibraryLoading] = useState(false);
	const [libraryFailed, setLibraryFailed] = useState(false);
	const [libraryAttempt, setLibraryAttempt] = useState(0);

	useEffect(() => {
		if (!open) return;
		setTab(initialFile ? "upload" : "upload");
		setFile(initialFile);
		setOptimize(false);
		setPrepared(null);
		setPicked(null);
		setAlt("");
		setCaption("");
		setDecorative(false);
		setAltTouched(false);
		setProgress(null);
		setError(null);
	}, [open, initialFile]);

	useEffect(() => {
		let cancelled = false;
		if (!file) {
			setPrepared(null);
			return;
		}
		prepareUpload(file, { optimize }).then((result) => {
			if (!cancelled) setPrepared(result);
		});
		return () => {
			cancelled = true;
		};
	}, [file, optimize]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: libraryAttempt는 다시 시도할 때 다시 읽게 한다
	useEffect(() => {
		if (!open || tab !== "library") return;
		let cancelled = false;
		setIsLibraryLoading(true);
		setLibraryFailed(false);
		const timer = setTimeout(() => {
			const params = new URLSearchParams({ pageSize: "24", kind: "image" });
			if (search.trim()) params.set("search", search.trim());
			fetch(cmsApiUrl(`/v1/media?${params.toString()}`))
				.then((res) => {
					if (!res.ok) throw new Error(String(res.status));
					return res.json();
				})
				.then((data: { items?: (LibraryItem & { status?: string })[] }) => {
					if (!cancelled) setLibrary((data.items ?? []).filter((item) => item.status !== "deleting"));
				})
				.catch(() => {
					if (cancelled) return;
					setLibrary([]);
					setLibraryFailed(true);
				})
				.finally(() => {
					if (!cancelled) setIsLibraryLoading(false);
				});
		}, 250);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [open, tab, search, libraryAttempt]);

	const isUploading = progress !== null;
	const needsAlt = !picking && !decorative && !alt.trim();
	const hasImage = tab === "upload" ? Boolean(prepared) : Boolean(picked);
	const canInsert = !isUploading && !needsAlt && hasImage;
	const showAltError = needsAlt && altTouched;

	const pick = (item: LibraryItem) => {
		setPicked(item);
		setAlt(item.defaultAlt);
		setCaption(item.defaultCaption);
		setDecorative(false);
	};

	const confirm = async (event?: FormEvent<HTMLFormElement>) => {
		event?.preventDefault();
		if (needsAlt && hasImage) setAltTouched(true);
		if (!canInsert) return;
		setError(null);
		if (tab === "library" && picked) {
			onInsert({
				mediaId: picked.id,
				alt: decorative ? "" : alt.trim(),
				decorative,
				caption: caption.trim(),
				publicUrl: picked.publicUrl,
			});
			return;
		}
		if (!prepared) return;
		setProgress(0);
		try {
			const uploaded = await uploadImageFile(prepared, setProgress);
			onInsert({
				mediaId: uploaded.mediaId,
				alt: decorative ? "" : alt.trim(),
				decorative,
				caption: caption.trim(),
				publicUrl: uploaded.publicUrl,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : t("imageDialog.uploadFailed"));
		} finally {
			setProgress(null);
		}
	};

	if (!media) {
		return (
			<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{MEDIA_NOT_CONFIGURED}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							{t("imageDialog.close")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !next && !isUploading && onClose()}>
			<DialogContent className="max-w-lg" showCloseButton={!isUploading}>
				<form
					onSubmit={(event) => void confirm(event)}
					// 한글 조합을 끝내는 Enter로 넣지 않는다. 여러 줄 칸에서도 Enter로 넣는다(Shift+Enter는 줄바꿈).
					onKeyDown={submitOnEnter}
					className="contents"
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{t("imageDialog.description")}</DialogDescription>
					</DialogHeader>

					<Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
						<TabsList variant="line" aria-label={t("imageDialog.sourceLabel")}>
							<TabsTrigger value="upload" disabled={isUploading}>
								{t("imageDialog.upload")}
							</TabsTrigger>
							<TabsTrigger value="library" disabled={isUploading}>
								{t("imageDialog.library")}
							</TabsTrigger>
						</TabsList>
					</Tabs>

					{tab === "upload" ? (
						<div className="space-y-2 text-sm">
							<Input
								type="file"
								aria-label={t("imageDialog.fileLabel")}
								accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
								disabled={isUploading}
								onChange={(event) => setFile(event.target.files?.[0] ?? null)}
							/>
							{file && (
								<>
									<Label htmlFor={optimizeId} className="font-normal">
										<Switch
											id={optimizeId}
											checked={optimize}
											disabled={isUploading}
											onCheckedChange={(checked) => setOptimize(checked)}
										/>
										{t("imageDialog.optimize")}
									</Label>
									<p className="text-cms-muted-foreground text-xs" aria-live="polite">
										{prepared?.optimized
											? `WebP · ${formatBytes(file.size)} → ${formatBytes(prepared.file.size)} · ${prepared.width}×${prepared.height}`
											: `${t("imageDialog.keepOriginal", { size: formatBytes(file.size) })}${prepared?.skippedReason ? ` · ${prepared.skippedReason}` : ""}`}
									</p>
								</>
							)}
						</div>
					) : (
						<div className="space-y-2">
							<Label htmlFor={searchId} className="sr-only">
								{t("imageDialog.search")}
							</Label>
							<Input
								id={searchId}
								value={search}
								placeholder={t("imageDialog.search")}
								onChange={(event) => setSearch(event.target.value)}
							/>
							<div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto" aria-busy={isLibraryLoading}>
								{isLibraryLoading &&
									library.length === 0 &&
									["a", "b", "c"].map((key) => <Skeleton key={key} className="h-[6.25rem] w-full rounded-md" />)}
								{libraryFailed && !isLibraryLoading && (
									<Alert variant="danger" className="col-span-3">
										<AlertDescription className="flex items-center justify-between gap-2">
											{t("imageDialog.libraryFailed")}
											<Button type="button" size="xs" variant="outline" onClick={() => setLibraryAttempt((n) => n + 1)}>
												{t("imageDialog.retry")}
											</Button>
										</AlertDescription>
									</Alert>
								)}
								{library.length === 0 && !isLibraryLoading && !libraryFailed && (
									<p className="col-span-3 py-6 text-center text-cms-muted-foreground text-sm">
										{t("imageDialog.libraryEmpty")}
									</p>
								)}
								{library.map((item) => (
									<Button
										key={item.id}
										type="button"
										variant="outline"
										aria-pressed={picked?.id === item.id}
										onClick={() => pick(item)}
										className={cn(
											"h-auto flex-col items-stretch gap-0 overflow-hidden p-0 text-left font-normal text-xs",
											picked?.id === item.id && "ring-2 ring-cms-primary",
										)}
									>
										{item.publicUrl ? (
											// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
											<img src={item.publicUrl} alt="" className="h-20 w-full object-cover" />
										) : (
											<span className="flex h-20 items-center justify-center bg-cms-muted">
												{t("imageDialog.noPreview")}
											</span>
										)}
										<span className="block truncate px-1 py-0.5">{item.filename}</span>
									</Button>
								))}
							</div>
						</div>
					)}

					<div className={cn("space-y-2 text-sm", picking && "hidden")}>
						<Label htmlFor={altId}>{t("imageDialog.alt")}</Label>
						<Textarea
							id={altId}
							value={alt}
							rows={2}
							disabled={decorative || isUploading}
							aria-required={!decorative}
							aria-invalid={showAltError || undefined}
							aria-describedby={showAltError ? altErrorId : undefined}
							onChange={(event) => {
								setAlt(event.target.value);
								setAltTouched(true);
							}}
							onBlur={() => setAltTouched(true)}
							className="min-h-0"
						/>
						{showAltError && (
							<p id={altErrorId} role="alert" className="text-cms-destructive text-xs">
								{ALT_REQUIRED_MESSAGE}
							</p>
						)}
						<Label htmlFor={decorativeId} className="font-normal">
							<Switch
								id={decorativeId}
								checked={decorative}
								disabled={isUploading}
								onCheckedChange={(checked) => setDecorative(checked)}
							/>
							{t("imageDialog.decorative")}
						</Label>
						<Label htmlFor={captionId}>{t("imageDialog.caption")}</Label>
						<Textarea
							id={captionId}
							value={caption}
							rows={2}
							disabled={isUploading}
							onChange={(event) => setCaption(event.target.value)}
							className="min-h-0"
						/>
					</div>

					{isUploading && (
						<output className="flex items-center gap-2 text-sm">
							<Spinner /> {t("imageDialog.uploading", { percent: progress ?? 0 })}
						</output>
					)}
					{error && (
						<p role="alert" className="text-cms-destructive text-sm">
							{error}
						</p>
					)}

					<DialogFooter>
						<Button type="button" variant="outline" disabled={isUploading} onClick={onClose}>
							{t("imageDialog.cancel")}
						</Button>
						<Button type="submit" disabled={isUploading || !hasImage}>
							{tab === "upload"
								? error
									? t("imageDialog.reupload")
									: picking
										? t("imageDialog.upload")
										: t("imageDialog.insert")
								: picking
									? t("imageDialog.pick")
									: t("imageDialog.insert")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
