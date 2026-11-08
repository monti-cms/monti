import { type ImageCrop, type ImageRotate, imageFrame, type MediaDetail } from "@monti-cms/core";
import {
	Button,
	type CropGrip,
	type CropRect,
	CropStage,
	FileBlock,
	FloatingBar,
	FloatingBarButton,
	FormField,
	FormFieldError,
	FormFieldLabel,
	Image,
	Inline,
	Input,
	Option,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ResizeCorner,
	Separator,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	Stack,
	Switch,
	Text,
	TextButton,
	UploadingImage,
} from "@monti-cms/ui";
import { Crop, Reset, Settings, TextAlignCenter, TextAlignLeft, TextAlignRight } from "@monti-cms/ui/icons";
import { type NodeViewProps, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { type ComponentType, useContext, useEffect, useId, useRef, useState } from "react";
import { extensionLabel, formatBytes, previewUrl } from "../media/file-text";
import { useAdmin } from "../operations/admin-context";
import { useRead } from "../operations/use-operation";
import { EditorMedia, nextBlankImage, openImageCard } from "./media-context";
import { useComposedValue } from "./use-composed-value";

type ImageData = {
	media?: string;
	alt?: string;
	caption?: string;
	decorative?: boolean;
	width?: number | null;
	align?: "left" | "center" | "right";
	crop?: ImageCrop;
	rotate?: ImageRotate;
};
type FileData = { media?: string; name?: string };

const JUSTIFY = { left: "start", center: "center", right: "end" } as const;
const ALIGNS = [
	{ value: "left", icon: TextAlignLeft, label: "editor.image.left" },
	{ value: "center", icon: TextAlignCenter, label: "editor.image.center" },
	{ value: "right", icon: TextAlignRight, label: "editor.image.right" },
] as const;
const MIN_WIDTH = 80;

/** A file on its way up, in its place in the text (flow 6·05): its bar while it goes, why it stays if it does not. */
function UploadInPlace({ id, onGone, isImage }: { id: string; onGone: () => void; isImage: boolean }) {
	const { t } = useAdmin();
	const media = useContext(EditorMedia);
	const upload = media?.uploads.find((each) => each.id === id);
	if (!media || !upload) return null;
	const problem = upload.problem;
	const takeOut = () => {
		media.remove(upload);
		onGone();
	};
	return (
		<Stack gap={8}>
			{isImage && (
				<UploadingImage
					src={problem === "type" || problem === "unreadable" ? null : upload.preview}
					progress={upload.progress}
					label={t("editor.image.uploading")}
				/>
			)}
			{!isImage && (
				<FileBlock
					name={upload.name}
					meta={problem ? "" : t("library.uploading", { percent: upload.progress })}
					tone={problem ? "danger" : "default"}
				/>
			)}
			{problem && (
				<Inline gap={12}>
					<Text variant="note" tone="danger">
						{problem === "tooBig"
							? t("library.failed.tooBig", { size: formatBytes(upload.size) })
							: t(`library.failed.${problem}`)}
					</Text>
					{problem === "tooBig" && isImage && (
						<TextButton onClick={() => void media.shrink(upload)}>{t("library.shrink")}</TextButton>
					)}
					{problem === "failed" && <TextButton onClick={() => media.retry(upload)}>{t("library.retry")}</TextButton>}
					<TextButton onClick={takeOut}>{t("library.takeOut")}</TextButton>
				</Inline>
			)}
		</Stack>
	);
}

/** A picture turned by whole quarters, as the crop sheet shows it: crops are parts of the turned picture (the core's `imageFrame`). */
async function turnedPicture(url: string, rotate: ImageRotate): Promise<string> {
	if (rotate === 0) return url;
	const element = new window.Image();
	element.crossOrigin = "anonymous";
	element.src = url;
	await element.decode();
	const picture = await createImageBitmap(element);
	const sideways = rotate === 90 || rotate === 270;
	const canvas = new OffscreenCanvas(
		sideways ? picture.height : picture.width,
		sideways ? picture.width : picture.height,
	);
	const context = canvas.getContext("2d");
	if (!context) return url;
	context.translate(canvas.width / 2, canvas.height / 2);
	context.rotate((rotate * Math.PI) / 180);
	context.drawImage(picture, -picture.width / 2, -picture.height / 2);
	return URL.createObjectURL(await canvas.convertToBlob({ type: "image/png" }));
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The crop after a grip moved to this point of the picture, in %. */
function movedCrop(start: CropRect, grip: CropGrip, dx: number, dy: number): CropRect {
	if (grip === "move")
		return {
			...start,
			x: clamp(start.x + dx, 0, 100 - start.width),
			y: clamp(start.y + dy, 0, 100 - start.height),
		};
	const left = grip === "nw" || grip === "sw" ? clamp(start.x + dx, 0, start.x + start.width - 5) : start.x;
	const top = grip === "nw" || grip === "ne" ? clamp(start.y + dy, 0, start.y + start.height - 5) : start.y;
	const right =
		grip === "ne" || grip === "se" ? clamp(start.x + start.width + dx, left + 5, 100) : start.x + start.width;
	const bottom =
		grip === "sw" || grip === "se" ? clamp(start.y + start.height + dy, top + 5, 100) : start.y + start.height;
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** "Crop and turn" (screens/editor.md): a sheet, because it takes several inputs. It changes nothing of the file: the block keeps which part shows. */
function CropSheet({
	src,
	crop,
	rotate,
	onApply,
	onClose,
}: {
	src: string;
	crop?: ImageCrop;
	rotate: ImageRotate;
	onApply: (crop: ImageCrop | undefined, rotate: ImageRotate) => void;
	onClose: () => void;
}) {
	const { t } = useAdmin();
	const [turn, setTurn] = useState<ImageRotate>(rotate);
	const [part, setPart] = useState<CropRect | undefined>(
		crop && { x: crop.x * 100, y: crop.y * 100, width: crop.width * 100, height: crop.height * 100 },
	);
	const [shown, setShown] = useState(src);
	const stage = useRef<HTMLDivElement>(null);
	useEffect(() => {
		let on = true;
		void turnedPicture(src, turn)
			.then((url) => {
				if (on) setShown(url);
			})
			// A picture on another address that does not allow reading it: the sheet shows it as it is, and the turn still applies.
			.catch(() => {
				if (on) setShown(src);
			});
		return () => {
			on = false;
		};
	}, [src, turn]);
	const pressed = (event: React.PointerEvent, grip: CropGrip) => {
		const box = stage.current?.getBoundingClientRect();
		if (!box) return;
		event.preventDefault();
		event.stopPropagation();
		const at = (x: number, y: number) => ({
			x: ((x - box.left) / box.width) * 100,
			y: ((y - box.top) / box.height) * 100,
		});
		const from = at(event.clientX, event.clientY);
		const begun: CropRect =
			grip === "stage"
				? { x: from.x, y: from.y, width: 0, height: 0 }
				: (part ?? { x: 0, y: 0, width: 100, height: 100 });
		const move = (next: PointerEvent) => {
			const to = at(next.clientX, next.clientY);
			setPart(
				grip === "stage"
					? {
							x: clamp(Math.min(from.x, to.x), 0, 100),
							y: clamp(Math.min(from.y, to.y), 0, 100),
							width: Math.max(5, Math.abs(to.x - from.x)),
							height: Math.max(5, Math.abs(to.y - from.y)),
						}
					: movedCrop(begun, grip, to.x - from.x, to.y - from.y),
			);
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};
	const turnBy = (quarter: 90 | -90) => {
		setPart(undefined);
		setTurn((current) => ((current + quarter + 360) % 360) as ImageRotate);
	};
	return (
		<Sheet open onOpenChange={(open) => !open && onClose()}>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>{t("editor.crop.title")}</SheetTitle>
				</SheetHeader>
				<SheetBody>
					<CropStage
						src={shown}
						alt=""
						crop={part}
						stageRef={stage}
						onGrip={pressed}
						cornerLabels={{
							nw: t("editor.crop.nw"),
							ne: t("editor.crop.ne"),
							sw: t("editor.crop.sw"),
							se: t("editor.crop.se"),
						}}
					/>
					<Inline gap={12}>
						<TextButton onClick={() => turnBy(-90)}>{t("editor.crop.turnLeft")}</TextButton>
						<TextButton onClick={() => turnBy(90)}>{t("editor.crop.turnRight")}</TextButton>
						<TextButton onClick={() => setPart(undefined)}>
							<Reset aria-hidden />
							{t("editor.crop.whole")}
						</TextButton>
					</Inline>
				</SheetBody>
				<SheetFooter>
					<Button
						onClick={() =>
							onApply(
								part && {
									x: part.x / 100,
									y: part.y / 100,
									width: part.width / 100,
									height: part.height / 100,
								},
								turn,
							)
						}
					>
						{t("editor.crop.apply")}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

/** An image in the body (doc 09, screens/editor.md): the picture, its tool row while it is picked, its settings card and the caption under it. */
function ImageBlockView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
	const { t } = useAdmin();
	const media = useContext(EditorMedia);
	const data = (node.attrs.data ?? {}) as ImageData;
	const blockId = String(node.attrs.blockId ?? "");
	const uploading = typeof node.attrs.upload === "string" ? node.attrs.upload : null;
	const file = useRead<MediaDetail>("media.get", { id: data.media ?? "" }, { skip: !data.media });
	const set = (next: Partial<ImageData>) => updateAttributes({ data: { ...data, ...next } });
	const caption = useComposedValue(data.caption ?? "", (value) => set({ caption: value }));
	const alt = useComposedValue(data.alt ?? "", (value) => set({ alt: value }));
	const [cropping, setCropping] = useState(false);
	const [dragged, setDragged] = useState<number | null>(null);
	const box = useRef<HTMLDivElement>(null);
	const altId = useId();
	const editable = editor.isEditable;
	const open = media?.card === blockId;

	if (uploading)
		return (
			<NodeViewWrapper data-block="image">
				<UploadInPlace id={uploading} isImage onGone={deleteNode} />
			</NodeViewWrapper>
		);

	const item = file.data;
	const url = item ? previewUrl(item) : null;
	const size = item ? (item.web ?? item.original) : null;
	const frame = imageFrame({ width: size?.width, height: size?.height, crop: data.crop, rotate: data.rotate });
	const width = dragged ?? data.width ?? null;
	const blank = !data.decorative && !(data.alt ?? "").trim();
	const align = data.align ?? "center";
	const next = () => {
		const after = nextBlankImage(editor, blockId);
		if (after) openImageCard(editor, after);
		else media?.setCard(null);
	};
	const resize = (side: "left" | "right") => (event: React.PointerEvent) => {
		const measured = box.current?.getBoundingClientRect();
		if (!measured) return;
		event.preventDefault();
		event.stopPropagation();
		const startX = event.clientX;
		const widthOfBody = box.current?.parentElement?.getBoundingClientRect().width ?? measured.width;
		const sized = (clientX: number) =>
			Math.round(
				clamp(measured.width + (side === "right" ? clientX - startX : startX - clientX), MIN_WIDTH, widthOfBody),
			);
		const move = (next: PointerEvent) => setDragged(sized(next.clientX));
		const finish = (keep: boolean) => (last: PointerEvent | KeyboardEvent) => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("keydown", esc);
			setDragged(null);
			if (keep && "clientX" in last) set({ width: sized(last.clientX) });
		};
		const up = finish(true);
		const esc = (key: KeyboardEvent) => {
			if (key.key === "Escape") finish(false)(key);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		window.addEventListener("keydown", esc);
	};
	const resizeKeys = (event: React.KeyboardEvent) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		event.preventDefault();
		event.stopPropagation();
		const measured = box.current?.getBoundingClientRect().width ?? 0;
		set({ width: Math.round(Math.max(MIN_WIDTH, (data.width ?? measured) + (event.key === "ArrowRight" ? 16 : -16))) });
	};

	return (
		<NodeViewWrapper data-block="image">
			<Stack gap={8}>
				<Inline justify={JUSTIFY[align]}>
					{/* design-allow: a width the writer dragged; the tool row and the corners hang off this box */}
					<div ref={box} className="relative w-full" style={width ? { width, maxWidth: "100%" } : undefined}>
						{url ? (
							<Image
								src={url}
								alt={data.decorative ? "" : (data.alt ?? "")}
								ratio="auto"
								radius="md"
								loading="eager"
								frame={frame}
							/>
						) : file.refusal ? (
							<Text variant="note" tone="danger">
								{t("editor.image.notFound")}
							</Text>
						) : null}
						{selected && editable && url && (
							<>
								{/* design-allow: the tool row floats over the block's top left, where the editor's overlays stand */}
								<div className="absolute z-1" style={{ top: -42, left: 0 }} contentEditable={false}>
									<FloatingBar>
										{ALIGNS.map(({ value, icon: Icon, label }) => (
											<FloatingBarButton
												key={value}
												label={t(label)}
												pressed={align === value}
												onClick={() => set({ align: value })}
											>
												<Icon aria-hidden />
											</FloatingBarButton>
										))}
										<Separator orientation="vertical" length="bar" />
										<Popover open={open} onOpenChange={(on) => media?.setCard(on ? blockId : null)}>
											<FloatingBarButton
												label={t("editor.image.settings")}
												pressed={open}
												trigger={(button) => <PopoverTrigger render={button} />}
											>
												<Settings aria-hidden />
											</FloatingBarButton>
											<PopoverContent align="start">
												<Stack gap={12}>
													<FormField>
														<FormFieldLabel htmlFor={`${altId}-width`}>{t("editor.image.width")}</FormFieldLabel>
														<Input
															id={`${altId}-width`}
															size="md"
															inputMode="numeric"
															placeholder={t("editor.image.fitBody")}
															value={data.width ?? ""}
															onChange={(event) => {
																const value = Number(event.target.value);
																set({ width: Number.isFinite(value) && value > 0 ? value : null });
															}}
														/>
													</FormField>
													<FormField>
														<FormFieldLabel htmlFor={altId}>{t("editor.image.alt")}</FormFieldLabel>
														<Input
															id={altId}
															size="md"
															autoFocus
															disabled={data.decorative === true}
															value={alt.value}
															onChange={(event) => alt.change(event.target.value)}
															{...alt.composition}
															onKeyDown={(event) => {
																if (event.key === "Enter") {
																	event.preventDefault();
																	next();
																}
															}}
														/>
														{blank && <FormFieldError>{t("editor.image.altMissing")}</FormFieldError>}
													</FormField>
													<Option spread>
														{t("editor.image.decorative")}
														<Switch
															checked={data.decorative === true}
															onCheckedChange={(on) => set({ decorative: on })}
														/>
													</Option>
													{nextBlankImage(editor, blockId) && (
														<TextButton onClick={next}>{t("editor.image.next")}</TextButton>
													)}
												</Stack>
											</PopoverContent>
										</Popover>
										<FloatingBarButton label={t("editor.image.crop")} onClick={() => setCropping(true)}>
											<Crop aria-hidden />
										</FloatingBarButton>
									</FloatingBar>
								</div>
								<ResizeCorner
									side="left"
									label={t("editor.image.resizeLeft")}
									onPointerDown={resize("left")}
									onKeyDown={resizeKeys}
								/>
								<ResizeCorner
									side="right"
									label={t("editor.image.resizeRight")}
									onPointerDown={resize("right")}
									onKeyDown={resizeKeys}
								/>
							</>
						)}
					</div>
				</Inline>
				{(editable || data.caption) && (
					<Input
						appearance="inline"
						size="sm"
						align={align === "left" ? "start" : align === "right" ? "end" : "center"}
						aria-label={t("editor.image.caption")}
						placeholder={t("editor.image.caption")}
						readOnly={!editable}
						value={caption.value}
						onChange={(event) => caption.change(event.target.value)}
						{...caption.composition}
					/>
				)}
			</Stack>
			{cropping && url && (
				<CropSheet
					src={url}
					crop={data.crop}
					rotate={data.rotate ?? 0}
					onClose={() => setCropping(false)}
					onApply={(crop, rotate) => {
						setCropping(false);
						set({ crop, rotate: rotate === 0 ? undefined : rotate });
					}}
				/>
			)}
		</NodeViewWrapper>
	);
}

/** A file in the body (flow 6·38): its icon, the name shown (this entry's to change), its type and size. */
function FileBlockView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
	const { t } = useAdmin();
	const data = (node.attrs.data ?? {}) as FileData;
	const uploading = typeof node.attrs.upload === "string" ? node.attrs.upload : null;
	const file = useRead<MediaDetail>("media.get", { id: data.media ?? "" }, { skip: !data.media });
	const shownName = useComposedValue(data.name ?? "", (name) => updateAttributes({ data: { ...data, name } }));
	if (uploading)
		return (
			<NodeViewWrapper data-block="file">
				<UploadInPlace id={uploading} isImage={false} onGone={deleteNode} />
			</NodeViewWrapper>
		);
	const item = file.data;
	return (
		<NodeViewWrapper data-block="file">
			<FileBlock
				name={shownName.value}
				placeholder={item?.name}
				nameLabel={t("editor.file.name")}
				onNameChange={editor.isEditable ? shownName.change : undefined}
				{...shownName.composition}
				tone={file.refusal ? "danger" : "default"}
				meta={
					file.refusal
						? t("editor.image.notFound")
						: item
							? `${extensionLabel(item.name)} · ${formatBytes(item.size)}`
							: ""
				}
			/>
		</NodeViewWrapper>
	);
}

/** How the core's image and file blocks draw in the editor. */
export const MEDIA_VIEWS: ReadonlyMap<string, ComponentType<ReactNodeViewProps>> = new Map([
	["image", ImageBlockView],
	["file", FileBlockView],
]);
