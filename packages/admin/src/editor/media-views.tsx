import {
	altIsMissing,
	type ImageCrop,
	type ImageRotate,
	imageAlignOf,
	imageFrame,
	type MediaItem,
} from "@monti-cms/core";
import {
	BlockBarPlace,
	BlockBox,
	Button,
	type CropCorner,
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
	IconButton,
	Image,
	Inline,
	Input,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ResizeCorner,
	Segmented,
	Separator,
	Stack,
	TextButton,
	UploadingImage,
} from "@monti-cms/ui";
import {
	Crop,
	Image as ImageIcon,
	Reset,
	RotateClockwise,
	RotateCounterclockwise,
	Settings,
	TextAlignCenter,
	TextAlignLeft,
	TextAlignRight,
} from "@monti-cms/ui/icons";
import type { Transaction } from "@tiptap/pm/state";
import { type NodeViewProps, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { type ComponentType, useContext, useEffect, useId, useRef, useState } from "react";
import { extensionLabel, formatBytes, previewUrl } from "../media/file-text";
import { RetryButton } from "../media/upload-problem";
import { useAdmin } from "../operations/admin-context";
import { AltFields } from "./alt-fields";
import { EditorMedia, fileBlock, nextBlankImage, openImageCard, useBodyFile } from "./media-context";
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
/**
 * What a file's end does to its block. It is no step of the writer's, so it stays out of undo: undone, the block would come back waiting for a file that has ended, end again at once
 * and clear what could be redone, and undo could never get past it.
 */
function uploadEnd({ editor, getPos, node }: Pick<NodeViewProps, "editor" | "getPos" | "node">) {
	const change = (apply: (at: number) => Transaction) => {
		const at = getPos();
		if (typeof at === "number") editor.view.dispatch(apply(at).setMeta("addToHistory", false));
	};
	return {
		gone: () => change((at) => editor.state.tr.delete(at, at + node.nodeSize)),
		done: (data: unknown) =>
			change((at) => editor.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, upload: null, data })),
	};
}

function UploadInPlace({
	id,
	isImage,
	selected,
	onDone,
	onGone,
}: {
	id: string;
	isImage: boolean;
	selected: boolean;
	onDone: (item: MediaItem) => void;
	onGone: () => void;
}) {
	const { t } = useAdmin();
	const media = useContext(EditorMedia);
	const upload = media?.uploads.find((each) => each.id === id);
	const latest = useRef({ onDone, onGone });
	latest.current = { onDone, onGone };
	useEffect(() => {
		if (!media || upload || media.holds(id)) return;
		const item = media.finished(id);
		if (item) latest.current.onDone(item);
		else latest.current.onGone();
	}, [media, upload, id]);
	if (!media || !upload) return null;
	// A file cut off says so in the box that stands for a file, and goes as any block goes (screens/editor.md).
	if (upload.status === "failed")
		return (
			<FileBlock
				name={upload.name}
				meta={t("library.failed")}
				tone="danger"
				selected={selected}
				action={<RetryButton onRetry={() => media.retry(upload)} />}
			/>
		);
	return isImage ? (
		<UploadingImage src={upload.preview} progress={upload.progress} label={t("editor.image.uploading")} />
	) : (
		<FileBlock name={upload.name} meta={t("library.uploading", { percent: upload.progress })} />
	);
}

/** A picture turned by whole quarters, as the crop dialog shows it: crops are parts of the turned picture (the core's `imageFrame`). */
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

/** The whole picture, as a crop: what the dialog starts from when nothing is cut away. */
const WHOLE: CropRect = { x: 0, y: 0, width: 100, height: 100 };
const isWhole = (part: CropRect) => part.x <= 0.01 && part.y <= 0.01 && part.width >= 99.99 && part.height >= 99.99;

/** The shapes a crop can keep, width to height; "free" keeps none and "original" the picture's own. */
const RATIOS = { free: null, original: null, "1:1": 1, "16:9": 16 / 9, "4:3": 4 / 3 } as const;
type Ratio = keyof typeof RATIOS;
const RATIO_ORDER: readonly Ratio[] = ["free", "original", "1:1", "16:9", "4:3"];

/**
 * A ratio as the crop's sides in % of the picture: width % over height %. The picture's own shape is 1 there; a pixel ratio is scaled by the picture's
 * height over its width. `null` keeps none.
 */
function shareRatio(ratio: Ratio, picture: { width: number; height: number } | null): number | null {
	if (ratio === "original") return 1;
	const pixels = RATIOS[ratio];
	return pixels === null || !picture ? null : (pixels * picture.height) / picture.width;
}

/** The largest crop of a ratio (in shares), in the middle of the picture. */
function centeredCrop(share: number): CropRect {
	const width = share >= 1 ? 100 : 100 * share;
	const height = share >= 1 ? 100 / share : 100;
	return { x: (100 - width) / 2, y: (100 - height) / 2, width, height };
}

/**
 * A crop pulled by a corner, kept to a ratio (in shares): the opposite corner stays. The pull counts on whichever side it moved more (an arrow up moves the
 * height), and the picture's edges win over the smallest size, so the crop never leaves the picture.
 */
function keptCrop(start: CropRect, pulled: CropRect, grip: CropCorner, share: number): CropRect {
	const west = grip === "nw" || grip === "sw";
	const north = grip === "nw" || grip === "ne";
	const anchorX = west ? start.x + start.width : start.x;
	const anchorY = north ? start.y + start.height : start.y;
	const byWidth = Math.abs(pulled.width - start.width) >= Math.abs(pulled.height - start.height) * share;
	const most = Math.min(west ? anchorX : 100 - anchorX, (north ? anchorY : 100 - anchorY) * share);
	const least = Math.min(Math.max(5, 5 * share), most);
	const width = Math.min(Math.max(byWidth ? pulled.width : pulled.height * share, least), most);
	const height = width / share;
	return { x: west ? anchorX - width : anchorX, y: north ? anchorY - height : anchorY, width, height };
}

/**
 * "Crop" (screens/editor.md): a dialog, because it takes several inputs. It changes nothing of the file: the block keeps which part shows. The picture fills
 * most of it; one line under it turns it a quarter (icons, their names on hover), keeps a shape, starts over, and cancels or applies (2026-11-10, owner:
 * a rotation reads as its arrow everywhere, so it needs no words). The crop starts as the whole picture, its corners there to take.
 */
function CropDialog({
	src,
	size: known,
	crop,
	rotate,
	onApply,
	onClose,
	returnTo,
}: {
	src: string;
	/** The picture's size as the body frames it (`imageFrame`): a kept shape is measured on it, so the body shows that shape. */
	size: { width: number; height: number } | null;
	crop?: ImageCrop;
	rotate: ImageRotate;
	onApply: (crop: ImageCrop | undefined, rotate: ImageRotate) => void;
	onClose: () => void;
	/** Where the focus goes when it closes: the text, not a caption field it was opened from, so ⌘Z takes back what it did. */
	returnTo: () => HTMLElement;
}) {
	const { t } = useAdmin();
	const [turn, setTurn] = useState<ImageRotate>(rotate);
	const [part, setPart] = useState<CropRect>(
		crop ? { x: crop.x * 100, y: crop.y * 100, width: crop.width * 100, height: crop.height * 100 } : WHOLE,
	);
	const [ratio, setRatio] = useState<Ratio>("free");
	const [shown, setShown] = useState(src);
	const stage = useRef<HTMLDivElement>(null);
	// The picture's own size: the one the body frames it by, else read once from the file (the shown one is redrawn after each turn, so it can lag).
	const [read, setRead] = useState<{ width: number; height: number } | null>(null);
	useEffect(() => {
		if (known) return;
		const image = new window.Image();
		image.onload = () => setRead({ width: image.naturalWidth, height: image.naturalHeight });
		image.src = src;
	}, [src, known]);
	const upright = known ?? read;
	/** The picture's size as it stands turned `at`: sideways, its sides swap. */
	const size = (at: ImageRotate = turn) =>
		upright && (at === 90 || at === 270 ? { width: upright.height, height: upright.width } : upright);
	useEffect(() => {
		let on = true;
		void turnedPicture(src, turn)
			.then((url) => {
				if (on) setShown(url);
			})
			// A picture on another address that does not allow reading it: the dialog shows it as it is, and the turn still applies.
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
		const share = shareRatio(ratio, size());
		const pressedAt = at(event.clientX, event.clientY);
		// A kept shape drawn from a point by the edge has no room to grow outward: the point stays at least the smallest crop inside.
		const from = share ? { x: clamp(pressedAt.x, 5, 95), y: clamp(pressedAt.y, 5, 95) } : pressedAt;
		const move = (next: PointerEvent) => {
			const to = at(next.clientX, next.clientY);
			if (grip === "stage") {
				const drawn = drawnCrop(from, to);
				// Drawn from the pressed point: that point is the corner that stays.
				const corner: CropCorner = `${to.y < from.y ? "n" : "s"}${to.x < from.x ? "w" : "e"}` as const;
				const begun = { x: from.x, y: from.y, width: 0, height: 0 };
				setPart(share ? keptCrop(begun, drawn, corner, share) : drawn);
				return;
			}
			const moved = movedCrop(part, grip, to.x - from.x, to.y - from.y);
			setPart(share && grip !== "move" ? keptCrop(part, moved, grip, share) : moved);
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
		if (!move || grip === "stage") return;
		event.preventDefault();
		const step = event.shiftKey ? 5 : 1;
		const moved = movedCrop(part, grip, move[0] * step, move[1] * step);
		const share = shareRatio(ratio, size());
		setPart(share && grip !== "move" ? keptCrop(part, moved, grip, share) : moved);
	};
	const turnBy = (quarter: 90 | -90) => {
		// The chosen part turns with the picture: the same part of it. A square, or the picture's own shape, is still that shape; 16:9 turned is 9:16, no
		// longer the shape picked, so the crop is free from then on.
		setPart((current) => turnedCrop(current, quarter));
		if (ratio === "16:9" || ratio === "4:3") setRatio("free");
		setTurn((current) => ((current + quarter + 360) % 360) as ImageRotate);
	};
	const pick = (next: Ratio) => {
		setRatio(next);
		const share = shareRatio(next, size());
		if (share) setPart(centeredCrop(share));
	};
	const changed = !isWhole(part) || turn !== 0;
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent size="xl" finalFocus={returnTo}>
				<DialogTitle>{t("editor.crop.title")}</DialogTitle>
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
				<DialogFooter>
					<Inline gap={8} grow>
						<IconButton label={t("editor.crop.turnLeft")} onClick={() => turnBy(-90)}>
							<RotateCounterclockwise aria-hidden />
						</IconButton>
						<IconButton label={t("editor.crop.turnRight")} onClick={() => turnBy(90)}>
							<RotateClockwise aria-hidden />
						</IconButton>
						<Segmented
							aria-label={t("editor.crop.ratio")}
							size="sm"
							inline
							value={ratio}
							onValueChange={pick}
							options={RATIO_ORDER.map((value) => ({
								value,
								label: value === "free" || value === "original" ? t(`editor.crop.${value}`) : value,
							}))}
						/>
						{changed && (
							<TextButton
								onClick={() => {
									setTurn(0);
									setPart(WHOLE);
									setRatio("free");
								}}
							>
								<Reset aria-hidden />
								{t("editor.crop.reset")}
							</TextButton>
						)}
					</Inline>
					<DialogClose render={<Button variant="ghost" />}>{t("settings.cancel")}</DialogClose>
					<Button
						onClick={() =>
							onApply(
								isWhole(part)
									? undefined
									: { x: part.x / 100, y: part.y / 100, width: part.width / 100, height: part.height / 100 },
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
function ImageBlockView({ node, updateAttributes, getPos, selected, editor }: NodeViewProps) {
	const { t } = useAdmin();
	const media = useContext(EditorMedia);
	const data = (node.attrs.data ?? {}) as ImageData;
	const blockId = String(node.attrs.blockId ?? "");
	const uploading = typeof node.attrs.upload === "string" ? node.attrs.upload : null;
	const stopped = uploading ? media?.uploads.find((each) => each.id === uploading)?.status === "failed" : false;
	const file = useBodyFile(data.media || undefined);
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
						selected={selected}
						onGone={uploadEnd({ editor, getPos, node }).gone}
						onDone={(done) => uploadEnd({ editor, getPos, node }).done({ ...data, ...fileBlock(done) })}
					/>
					{!stopped && captionField}
				</Stack>
			</NodeViewWrapper>
		);

	const { item } = file;
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
								alt={file.missing ? t("editor.image.notFound") : ""}
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
					size={size?.width && size.height ? { width: size.width, height: size.height } : null}
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
function FileBlockView({ node, updateAttributes, getPos, selected, editor }: NodeViewProps) {
	const { t } = useAdmin();
	const media = useContext(EditorMedia);
	const data = (node.attrs.data ?? {}) as FileData;
	const blockId = String(node.attrs.blockId ?? "");
	const open = media?.card === blockId;
	const nameId = useId();
	const bar = useRef<HTMLDivElement>(null);
	const uploading = typeof node.attrs.upload === "string" ? node.attrs.upload : null;
	const file = useBodyFile(data.media || undefined);
	const shownName = useComposedValue(data.name ?? "", (name) => updateAttributes({ data: { ...data, name } }));
	if (uploading)
		return (
			<NodeViewWrapper data-block="file">
				<UploadInPlace
					id={uploading}
					isImage={false}
					selected={selected}
					onGone={uploadEnd({ editor, getPos, node }).gone}
					onDone={(done) => uploadEnd({ editor, getPos, node }).done(fileBlock(done))}
				/>
			</NodeViewWrapper>
		);
	const { item } = file;
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
					tone={file.missing ? "danger" : "default"}
					meta={
						file.missing
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
