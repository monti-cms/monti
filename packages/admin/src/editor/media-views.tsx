import {
	altIsMissing,
	type ImageCrop,
	type ImageRotate,
	imageAlignOf,
	imageFrame,
	type MediaDetail,
	type MediaItem,
} from "@monti-cms/core";
import {
	BlockBarPlace,
	BlockBox,
	Button,
	type CropGrip,
	type CropRect,
	CropStage,
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogTitle,
	FileBlock,
	FloatingBar,
	FloatingBarButton,
	FormField,
	FormFieldLabel,
	Image,
	Inline,
	Input,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ResizeCorner,
	Separator,
	Stack,
	TextButton,
	UploadingImage,
} from "@monti-cms/ui";
import {
	Crop,
	Image as ImageIcon,
	Reset,
	Settings,
	TextAlignCenter,
	TextAlignLeft,
	TextAlignRight,
} from "@monti-cms/ui/icons";
import { type NodeViewProps, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { type ComponentType, useContext, useEffect, useId, useRef, useState } from "react";
import { extensionLabel, formatBytes, previewUrl } from "../media/file-text";
import { UploadActions, useProblemText } from "../media/upload-problem";
import { useAdmin } from "../operations/admin-context";
import { useRead } from "../operations/use-operation";
import { AltFields } from "./alt-fields";
import { EditorMedia, fileBlock, nextBlankImage, openImageCard } from "./media-context";
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
/** The caption stands where its picture stands. */
const CAPTION_ALIGN = { left: "start", center: "center", right: "end" } as const;
const MIN_WIDTH = 80;

/**
 * A file on its way up, in its place in the text (flow 6·05): its bar while it goes, why it stays if it does not. A block can come back after its upload ended (undo, then
 * redo): it takes what the upload became, or goes if the file was taken out.
 */
function UploadInPlace({
	id,
	isImage,
	onDone,
	onGone,
}: {
	id: string;
	isImage: boolean;
	onDone: (item: MediaItem) => void;
	onGone: () => void;
}) {
	const { t } = useAdmin();
	const media = useContext(EditorMedia);
	const upload = media?.uploads.find((each) => each.id === id);
	const problemText = useProblemText();
	const latest = useRef({ onDone, onGone });
	latest.current = { onDone, onGone };
	useEffect(() => {
		if (!media || upload || media.holds(id)) return;
		const item = media.finished(id);
		if (item) latest.current.onDone(item);
		else latest.current.onGone();
	}, [media, upload, id]);
	if (!media || !upload) return null;
	const { problem } = upload;
	// A file that stopped says so in the box that stands for a file, with what can be done under it (screens/editor.md).
	if (problem)
		return (
			<Stack gap={8}>
				<FileBlock name={upload.name} meta={problemText(upload)} tone="danger" />
				<UploadActions
					upload={upload}
					onRemove={(each) => {
						media.remove(each);
						onGone();
					}}
					onRetry={media.retry}
					onShrink={media.shrink}
				/>
			</Stack>
		);
	return isImage ? (
		<UploadingImage src={upload.preview} progress={upload.progress} label={t("editor.image.uploading")} />
	) : (
		<FileBlock name={upload.name} meta={t("library.uploading", { percent: upload.progress })} />
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

/** A crop after its picture turned a quarter: the same part of the picture. Its sides are shares of the picture's, so they swap with no sum. */
const turnedCrop = (part: CropRect, quarter: 90 | -90): CropRect =>
	quarter === 90
		? { x: 100 - part.y - part.height, y: part.x, width: part.height, height: part.width }
		: { x: part.y, y: 100 - part.x - part.width, width: part.height, height: part.width };

/** A new crop drawn from one point to another, in %: never smaller than a handle can hold, and always inside the picture wherever the pointer went. */
function drawnCrop(from: { x: number; y: number }, to: { x: number; y: number }): CropRect {
	const x = clamp(Math.min(from.x, to.x), 0, 95);
	const y = clamp(Math.min(from.y, to.y), 0, 95);
	return {
		x,
		y,
		width: clamp(Math.max(from.x, to.x) - x, 5, 100 - x),
		height: clamp(Math.max(from.y, to.y) - y, 5, 100 - y),
	};
}

const KEY_MOVES: Partial<Record<string, readonly [number, number]>> = {
	ArrowLeft: [-1, 0],
	ArrowRight: [1, 0],
	ArrowUp: [0, -1],
	ArrowDown: [0, 1],
};

/** "Crop and turn" (screens/editor.md): a sheet, because it takes several inputs. It changes nothing of the file: the block keeps which part shows. */
function CropDialog({
	src,
	crop,
	rotate,
	onApply,
	onClose,
	returnTo,
}: {
	src: string;
	crop?: ImageCrop;
	rotate: ImageRotate;
	onApply: (crop: ImageCrop | undefined, rotate: ImageRotate) => void;
	onClose: () => void;
	/** Where the focus goes when it closes: the text, not a caption field it was opened from, so ⌘Z takes back what it did. */
	returnTo: () => HTMLElement;
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
			setPart(grip === "stage" ? drawnCrop(from, to) : movedCrop(begun, grip, to.x - from.x, to.y - from.y));
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};
	const pressedKey = (event: React.KeyboardEvent, grip: CropGrip) => {
		const move = KEY_MOVES[event.key];
		if (!move || !part || grip === "stage") return;
		event.preventDefault();
		const step = event.shiftKey ? 5 : 1;
		setPart(movedCrop(part, grip, move[0] * step, move[1] * step));
	};
	const turnBy = (quarter: 90 | -90) => {
		setPart((current) => current && turnedCrop(current, quarter));
		setTurn((current) => ((current + quarter + 360) % 360) as ImageRotate);
	};
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent size="lg" finalFocus={returnTo}>
				<DialogTitle>{t("editor.crop.title")}</DialogTitle>
				<Stack gap={12}>
					<CropStage
						src={shown}
						alt=""
						crop={part}
						stageRef={stage}
						onGrip={pressed}
						onGripKey={pressedKey}
						moveLabel={t("editor.crop.move")}
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
						{part ? (
							<TextButton onClick={() => setPart(undefined)}>
								<Reset aria-hidden />
								{t("editor.crop.whole")}
							</TextButton>
						) : (
							// The way into a crop without a pointer: then the box and its corners move with the arrows.
							<TextButton onClick={() => setPart({ x: 10, y: 10, width: 80, height: 80 })}>
								{t("editor.crop.start")}
							</TextButton>
						)}
					</Inline>
				</Stack>
				<DialogFooter>
					<DialogClose render={<Button variant="ghost" />}>{t("settings.cancel")}</DialogClose>
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
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** An image in the body (doc 09, screens/editor.md): the picture, its tool row while it is picked, its settings card and the caption under it. */
function ImageBlockView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
	const { t } = useAdmin();
	const media = useContext(EditorMedia);
	const data = (node.attrs.data ?? {}) as ImageData;
	const blockId = String(node.attrs.blockId ?? "");
	const uploading = typeof node.attrs.upload === "string" ? node.attrs.upload : null;
	const stopped = uploading ? media?.uploads.find((each) => each.id === uploading)?.problem : null;
	const file = useRead<MediaDetail>("media.get", { id: data.media ?? "" }, { skip: !data.media });
	const set = (next: Partial<ImageData>) => updateAttributes({ data: { ...data, ...next } });
	const caption = useComposedValue(data.caption ?? "", (value) => set({ caption: value }));
	const [cropping, setCropping] = useState(false);
	const [dragged, setDragged] = useState<number | null>(null);
	const box = useRef<HTMLDivElement>(null);
	const bar = useRef<HTMLDivElement>(null);
	const widthId = useId();
	const editable = editor.isEditable;
	const open = media?.card === blockId;
	const align = imageAlignOf(data.align);

	const captionField = (editable || data.caption) && (
		<Input
			appearance="inline"
			size="sm"
			align={CAPTION_ALIGN[align]}
			aria-label={t("editor.image.caption")}
			placeholder={t("editor.image.caption")}
			readOnly={!editable}
			value={caption.value}
			onChange={(event) => caption.change(event.target.value)}
			{...caption.composition}
		/>
	);

	if (uploading)
		return (
			<NodeViewWrapper data-block="image">
				<Stack gap={8}>
					<UploadInPlace
						id={uploading}
						isImage
						onGone={deleteNode}
						onDone={(done) => updateAttributes({ upload: null, data: { ...data, ...fileBlock(done) } })}
					/>
					{!stopped && captionField}
				</Stack>
			</NodeViewWrapper>
		);

	const item = file.data;
	const url = item ? previewUrl(item) : null;
	const size = item ? (item.web ?? item.original) : null;
	const frame = imageFrame({ width: size?.width, height: size?.height, crop: data.crop, rotate: data.rotate });
	const width = dragged ?? data.width ?? null;
	const blank = altIsMissing(data);
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
					<BlockBox ref={box} width={width}>
						{url ? (
							<Image
								src={url}
								alt={data.decorative ? "" : (data.alt ?? "")}
								ratio="auto"
								radius="md"
								loading="eager"
								frame={frame}
							/>
						) : (
							// While it loads, and for a file the library does not have: the frame with nothing in it (editor-tools.md).
							<Image
								src={null}
								alt={file.refusal ? t("editor.image.notFound") : ""}
								fallback={ImageIcon}
								ratio="wide"
							/>
						)}
						{selected && editable && url && (
							<>
								<BlockBarPlace>
									<FloatingBar ref={bar}>
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
											<PopoverContent anchor={bar} align="start">
												<Stack gap={12}>
													<FormField>
														<FormFieldLabel htmlFor={widthId}>{t("editor.image.width")}</FormFieldLabel>
														<Input
															id={widthId}
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
													<AltFields
														value={data.alt ?? ""}
														decorative={data.decorative === true}
														missing={blank}
														onChange={(value) => set({ alt: value })}
														onDecorative={(on) => set({ decorative: on })}
														onEnter={next}
													/>
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
								</BlockBarPlace>
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
					</BlockBox>
				</Inline>
				{captionField}
			</Stack>
			{cropping && url && (
				<CropDialog
					src={url}
					crop={data.crop}
					rotate={data.rotate ?? 0}
					returnTo={() => editor.view.dom}
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
function FileBlockView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
	const { t } = useAdmin();
	const media = useContext(EditorMedia);
	const data = (node.attrs.data ?? {}) as FileData;
	const blockId = String(node.attrs.blockId ?? "");
	const open = media?.card === blockId;
	const nameId = useId();
	const bar = useRef<HTMLDivElement>(null);
	const uploading = typeof node.attrs.upload === "string" ? node.attrs.upload : null;
	const file = useRead<MediaDetail>("media.get", { id: data.media ?? "" }, { skip: !data.media });
	const shownName = useComposedValue(data.name ?? "", (name) => updateAttributes({ data: { ...data, name } }));
	if (uploading)
		return (
			<NodeViewWrapper data-block="file">
				<UploadInPlace
					id={uploading}
					isImage={false}
					onGone={deleteNode}
					onDone={(done) => updateAttributes({ upload: null, data: fileBlock(done) })}
				/>
			</NodeViewWrapper>
		);
	const item = file.data;
	return (
		<NodeViewWrapper data-block="file">
			<BlockBox>
				{selected && editor.isEditable && (
					<BlockBarPlace>
						<FloatingBar ref={bar}>
							<Popover open={open} onOpenChange={(on) => media?.setCard(on ? blockId : null)}>
								<FloatingBarButton
									label={t("editor.image.settings")}
									pressed={open}
									trigger={(button) => <PopoverTrigger render={button} />}
								>
									<Settings aria-hidden />
								</FloatingBarButton>
								<PopoverContent anchor={bar} align="start">
									<FormField>
										<FormFieldLabel htmlFor={nameId}>{t("editor.file.name")}</FormFieldLabel>
										<Input
											id={nameId}
											size="md"
											value={shownName.value}
											placeholder={item?.name}
											onChange={(event) => shownName.change(event.target.value)}
											{...shownName.composition}
										/>
									</FormField>
								</PopoverContent>
							</Popover>
						</FloatingBar>
					</BlockBarPlace>
				)}
				<FileBlock
					name={shownName.value || item?.name || ""}
					selected={selected}
					tone={file.refusal ? "danger" : "default"}
					meta={
						file.refusal
							? t("editor.image.notFound")
							: item
								? `${extensionLabel(item.name)} · ${formatBytes(item.size)}`
								: ""
					}
				/>
			</BlockBox>
		</NodeViewWrapper>
	);
}

/** How the core's image and file blocks draw in the editor. */
export const MEDIA_VIEWS: ReadonlyMap<string, ComponentType<ReactNodeViewProps>> = new Map([
	["image", ImageBlockView],
	["file", FileBlockView],
]);
