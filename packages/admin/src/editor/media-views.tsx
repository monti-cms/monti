import {
	altIsMissing,
	type ImageAttrs,
	type ImageCrop,
	type ImageRotate,
	type ImageSizeAttrs,
	imageAlignOf,
	imageFrame,
	imageSize,
	type MediaItem,
} from "@monti-cms/core";
import {
	BlockBarPlace,
	BlockBox,
	type BlockCorner,
	type BlockWidth,
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
	Text,
	TextButton,
	UploadingImage,
} from "@monti-cms/ui";
import {
	Edit,
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

type ImageData = Partial<ImageAttrs>;
type FileData = { media?: string; name?: string };

const JUSTIFY = { left: "start", center: "center", right: "end" } as const;
const ALIGNS = [
	{ value: "left", icon: TextAlignLeft, label: "editor.image.left" },
	{ value: "center", icon: TextAlignCenter, label: "editor.image.center" },
	{ value: "right", icon: TextAlignRight, label: "editor.image.right" },
] as const;
/** The caption stands where its picture stands. */
const CAPTION_ALIGN = { left: "start", center: "center", right: "end" } as const;
/** The smallest a picture is pulled to, in px on the screen: an icon's size. */
const MIN_WIDTH = 24;
/** A picture's width as the writer gives it: in px, or a share of the body (doc 09). */
type Unit = "px" | "%";
/** One arrow press on a corner. */
const KEY_STEP: Record<Unit, number> = { px: 10, "%": 5 };
/** The size a block gives its picture; `null` is the picture's own (narrowed by the body as any width is). */
type Sized = { unit: Unit; value: number } | null;
const sizedOf = (data: ImageData): Sized =>
	data.widthPercent !== undefined
		? { unit: "%", value: data.widthPercent }
		: data.width !== undefined
			? { unit: "px", value: data.width }
			: null;
/** A size as the block's attrs: one of the two widths, the other cleared. */
const attrsOf = (sized: Sized): ImageSizeAttrs =>
	sized?.unit === "%"
		? { widthPercent: sized.value, width: undefined }
		: { width: sized?.value, widthPercent: undefined };
const sameSized = (a: Sized, b: Sized) => a?.unit === b?.unit && a?.value === b?.value;

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
				// The entry cannot be changed (archived since the file was cut off): the file stays to be tried again later, with no way to try it now.
				action={media.readOnly ? undefined : <RetryButton onRetry={() => media.retry(upload)} />}
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
const RATIOS = { original: null, "1:1": 1, "4:3": 4 / 3, "16:9": 16 / 9, free: null } as const;
type Ratio = keyof typeof RATIOS;
const RATIO_ORDER: readonly Ratio[] = ["original", "1:1", "4:3", "16:9", "free"];
const FIXED_RATIOS = ["1:1", "4:3", "16:9"] as const;

/** The shape a crop was cut to, for the dialog to open on: the picture's own when nothing is cut, a fixed one it matches, else free. */
function ratioOf(part: CropRect, picture: { width: number; height: number } | null): Ratio {
	if (isWhole(part)) return "original";
	if (!picture) return "free";
	const pixels = (picture.width * part.width) / (picture.height * part.height);
	const near = (ratio: number) => Math.abs(ratio - pixels) < 0.01;
	if (near(picture.width / picture.height)) return "original";
	return FIXED_RATIOS.find((each) => near(RATIOS[each])) ?? "free";
}

/** A crop in % as the block keeps it, in parts of the picture: none for the whole picture. */
const cropOf = (part: CropRect): ImageCrop | undefined =>
	isWhole(part) ? undefined : { x: part.x / 100, y: part.y / 100, width: part.width / 100, height: part.height / 100 };

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

/** A crop of a new ratio (in shares) as wide as the one before, around its middle, inside the picture: a ratio it has already leaves it as it is. */
function reshapedCrop(before: CropRect, share: number): CropRect {
	const tall = before.width / share > 100;
	const width = tall ? 100 * share : before.width;
	const height = tall ? 100 : before.width / share;
	const middle = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
	return {
		width,
		height,
		x: clamp(middle.x - width / 2, 0, 100 - width),
		y: clamp(middle.y - height / 2, 0, 100 - height),
	};
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

/** Only digits from a number field; an empty one is no number. */
const digitsOf = (text: string) => text.replace(/\D/g, "");

/**
 * "Edit" (screens/editor.md): how the picture looks, in a dialog because it takes several inputs; what the entry says of it is the settings card's (2026-11-10,
 * owner). It changes nothing of the file: the block keeps which part shows, how it is turned and its size. The picture fills most of it. Under it: turning a
 * quarter (icons, their names on hover) and the shape the crop keeps; then the size, a width and a height in px or one share of the body; then starting over,
 * cancelling and applying. The crop starts as the whole picture, its corners there to take. A size never goes past what shows of the picture.
 */
function EditDialog({
	src,
	size: known,
	crop,
	rotate,
	sized,
	column,
	onApply,
	onClose,
	returnTo,
}: {
	src: string;
	/** The picture's size as the body frames it (`imageFrame`): a kept shape is measured on it, so the body shows that shape. */
	size: { width: number; height: number } | null;
	crop?: ImageCrop;
	rotate: ImageRotate;
	sized: Sized;
	/** The body's width on this screen, to turn a width in px into a share and back. */
	column: number | null;
	onApply: (edit: { crop: ImageCrop | undefined; rotate: ImageRotate; sized: Sized }) => void;
	onClose: () => void;
	/** Where the focus goes when it closes: the text, not a caption field it was opened from, so ⌘Z takes back what it did. */
	returnTo: () => HTMLElement;
}) {
	const { t } = useAdmin();
	const [turn, setTurn] = useState<ImageRotate>(rotate);
	const [part, setPart] = useState<CropRect>(
		crop ? { x: crop.x * 100, y: crop.y * 100, width: crop.width * 100, height: crop.height * 100 } : WHOLE,
	);
	const [unit, setUnit] = useState<Unit>(sized?.unit ?? "px");
	/** The width typed, in the unit: `null` is the picture's own. */
	const [amount, setAmount] = useState<number | null>(sized?.value ?? null);
	/** A height being typed: a free shape takes it when the field is left, so each digit does not cut the picture anew. */
	const [heightDraft, setHeightDraft] = useState<string | null>(null);
	// The picture as it stands turned. One that opens turned has none until it is made: the stage stands empty at its shape meanwhile, not the upright one.
	const [shown, setShown] = useState<string | null>(rotate === 0 ? src : null);
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
	const [ratio, setRatio] = useState<Ratio>(() => ratioOf(part, size(rotate)));
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

	// What shows of the picture now, at its own size (the core's sum, as the body and the site draw it): the most a width in px can be.
	const own = upright && imageSize(upright, { crop: cropOf(part), rotate: turn });
	const most = own?.width ?? null;
	const widthPx = unit === "px" && amount !== null ? Math.min(amount, most ?? amount) : null;
	const typedWidth = (text: string) => {
		const digits = digitsOf(text);
		setAmount(digits === "" ? null : clamp(Number(digits), 1, unit === "%" ? 100 : (most ?? Number(digits))));
	};
	const typedHeight = (text: string) => {
		const digits = digitsOf(text);
		setHeightDraft(digits);
		// A free shape waits for the field to be left; a kept one moves the width with each digit.
		if (ratio === "free" || !own) return;
		setAmount(digits === "" ? null : clamp(Math.round((Number(digits) * own.width) / own.height), 1, own.width));
	};
	/** A height left typed in a free shape: the crop takes the shape of the two numbers, around where it was, and keeps the width. */
	const heightDone = () => {
		const digits = heightDraft;
		setHeightDraft(null);
		const turned = size();
		if (ratio !== "free" || !digits || !turned || !upright || !most) return;
		const width = widthPx ?? most;
		const next = reshapedCrop(part, ((width / Math.max(1, Number(digits))) * turned.height) / turned.width);
		setPart(next);
		setAmount(Math.min(width, imageSize(upright, { crop: cropOf(next), rotate: turn })?.width ?? width));
	};
	/** The same width in the other unit; no size stays none, its field showing what the picture's own size is in that unit. */
	const switchUnit = (next: Unit) => {
		if (next === unit) return;
		setUnit(next);
		setHeightDraft(null);
		if (amount === null) return;
		if (!column || !most) return setAmount(null);
		if (next === "%") setAmount(clamp(Math.round(((widthPx ?? most) / column) * 100), 1, 100));
		else setAmount(Math.min(Math.max(1, Math.round((amount * column) / 100)), most));
	};
	/** The size to keep: a width in px as wide as what shows is the picture's own. */
	const sizedNow = (): Sized => {
		if (amount === null) return null;
		if (unit === "%") return { unit, value: amount };
		return widthPx === null || (most !== null && widthPx >= most) ? null : { unit, value: widthPx };
	};
	const changed = !isWhole(part) || turn !== 0 || amount !== null;
	const height =
		widthPx === null || !upright
			? null
			: (imageSize(upright, { crop: cropOf(part), rotate: turn, width: widthPx })?.height ?? null);
	const turned = size();
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent size="xl" finalFocus={returnTo}>
				<DialogTitle>{t("editor.edit.title")}</DialogTitle>
				<CropStage
					src={shown}
					alt=""
					// Known before the picture is in: the crop box stands as large as the picture will be, not as a dot (T136).
					shape={turned ? turned.width / turned.height : null}
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
				<Inline gap={8} justify="between" wrap>
					<Inline gap={8}>
						<IconButton size="sm" label={t("editor.crop.turnLeft")} onClick={() => turnBy(-90)}>
							<RotateCounterclockwise aria-hidden />
						</IconButton>
						<IconButton size="sm" label={t("editor.crop.turnRight")} onClick={() => turnBy(90)}>
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
					</Inline>
					<Inline gap={8} role="group" aria-label={t("editor.edit.size")}>
						<Text variant="note" tone="subtle" aria-hidden>
							{t("editor.edit.size")}
						</Text>
						<Input
							size="sm"
							width="number"
							mono
							inputMode="numeric"
							align="end"
							aria-label={t("editor.edit.width")}
							value={unit === "px" ? (widthPx ?? "") : (amount ?? "")}
							placeholder={
								most === null
									? undefined
									: unit === "px"
										? String(most)
										: column
											? String(clamp(Math.round((Math.min(most, column) / column) * 100), 1, 100))
											: undefined
							}
							onChange={(event) => typedWidth(event.target.value)}
						/>
						{unit === "px" && (
							<>
								<Text variant="note" tone="subtle" aria-hidden>
									×
								</Text>
								<Input
									size="sm"
									width="number"
									mono
									inputMode="numeric"
									align="end"
									aria-label={t("editor.edit.height")}
									value={heightDraft ?? height ?? ""}
									placeholder={own ? String(own.height) : undefined}
									onChange={(event) => typedHeight(event.target.value)}
									onBlur={heightDone}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											heightDone();
										}
									}}
								/>
							</>
						)}
						<Segmented
							aria-label={t("editor.edit.unit")}
							size="sm"
							inline
							value={unit}
							onValueChange={switchUnit}
							options={[
								{ value: "px", label: "px" },
								{ value: "%", label: "%" },
							]}
						/>
					</Inline>
				</Inline>
				<DialogFooter>
					<Inline gap={8} grow>
						{changed && (
							<TextButton
								onClick={() => {
									setTurn(0);
									setPart(WHOLE);
									setRatio("original");
									setUnit("px");
									setAmount(null);
									setHeightDraft(null);
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
							onApply({
								crop: cropOf(part),
								rotate: turn,
								sized: sizedNow(),
							})
						}
					>
						{t("editor.crop.apply")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * A selected picture's handles, by where it stands: each one moves the edge under it. A picture in the middle grows both ways, so it has all four; one held
 * to a side cannot move that side, so it has the two on the other.
 */
const CORNERS: Record<"left" | "center" | "right", readonly BlockCorner[]> = {
	left: ["ne", "se"],
	center: ["nw", "ne", "sw", "se"],
	right: ["nw", "sw"],
};

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
	const [editing, setEditing] = useState(false);
	/** The size a corner being dragged makes; `null` while nothing is dragged. */
	const [dragged, setDragged] = useState<{ to: Sized } | null>(null);
	/** What a screen reader hears of the size as it changes. */
	const [spoken, setSpoken] = useState<string>();
	const box = useRef<HTMLDivElement>(null);
	const bar = useRef<HTMLDivElement>(null);
	// From the body, not from the editor: a block already drawn is not drawn again when the editor is switched to read-only (an entry archived with a
	// picture picked kept its tools, and they worked), and the body's word reaches it.
	const editable = media ? !media.readOnly : editor.isEditable;
	const open = media?.card === blockId;
	const align = imageAlignOf(data.align);
	/**
	 * In a body that cannot be written in, the keyboard stops at the picture (T133, 2026-11-12): read-only takes away what writes, never a way to read. The
	 * stop shows the keyboard's ordinary focus mark; Enter or Space picks the picture as a press does (the line of a picked block, and its bar, the focus going
	 * into it), and Escape unpicks it, the focus staying on the picture. Two states, each looking as it does everywhere: where the keyboard is, and what is
	 * picked. `shut` is a picture unpicked with Escape: the editor has no selection that is none, so it still holds the block, and nothing is drawn for it.
	 */
	const [shut, setShut] = useState(false);
	const picked = selected && (editable || !shut || open);
	/** The bar was asked for with a key: the focus goes into it once it is drawn. */
	const intoBar = useRef(false);
	useEffect(() => {
		if (!selected) setShut(false);
	}, [selected]);
	useEffect(() => {
		if (!picked || !intoBar.current) return;
		intoBar.current = false;
		bar.current?.querySelector("button")?.focus();
	}, [picked]);
	// Escape is heard on the page as the key goes down to its target: a button of the bar shows its name in a tooltip while it holds the focus, and the
	// tooltip keeps Escape from going back up. While the settings card is open, Escape is the card's.
	const barOpen = picked && !editable && !open;
	useEffect(() => {
		if (!barOpen) return;
		const unpick = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || !box.current?.contains(document.activeElement)) return;
			setShut(true);
			box.current.focus();
		};
		document.addEventListener("keydown", unpick, true);
		return () => document.removeEventListener("keydown", unpick, true);
	}, [barOpen]);

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
	const pick = () => {
		const at = getPos();
		if (typeof at === "number") editor.commands.setNodeSelection(at);
	};
	/** What makes the picture a stop of the keyboard where the body is read only; where it is written, the arrow keys pick blocks and nothing here is set. */
	const stop: Partial<React.ComponentProps<typeof BlockBox>> =
		editable || !url
			? {}
			: {
					tabIndex: 0,
					role: "group",
					"aria-label": t("editor.image.block"),
					// A press on a picture unpicked with Escape picks it again (the editor never let go of it).
					onClick: () => setShut(false),
					onKeyDown: (event) => {
						if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
						event.preventDefault();
						intoBar.current = true;
						setShut(false);
						if (!selected) pick();
					},
				};
	const size = item ? (item.web ?? item.original) : null;
	const frame = imageFrame({ width: size?.width, height: size?.height, crop: data.crop, rotate: data.rotate });
	const sized = sizedOf(data);
	/** What shows of the picture at its own size, in px: the most a width in px can be. */
	const own = size ? imageSize(size, { crop: data.crop, rotate: data.rotate }) : null;
	const blank = altIsMissing(data);
	const next = () => {
		const after = nextBlankImage(editor, blockId);
		if (after) openImageCard(editor, after);
		else media?.setCard(null);
	};
	/** The column the picture stands in: the box's parent, its full width. */
	const bodyWidth = () => box.current?.parentElement?.getBoundingClientRect().width;
	/** A size as it reads on the picture while it changes and to a screen reader: the size it is drawn at ("420 × 280", narrowed by the body), or "50%". */
	const sizeLabel = (to: Sized) => {
		if (to?.unit === "%") return `${to.value}%`;
		const column = bodyWidth();
		const width = Math.min(
			to?.value ?? Number.POSITIVE_INFINITY,
			column ? Math.floor(column) : Number.POSITIVE_INFINITY,
		);
		const drawn =
			size &&
			imageSize(size, { crop: data.crop, rotate: data.rotate, width: Number.isFinite(width) ? width : undefined });
		return drawn ? `${drawn.width} × ${drawn.height}` : "";
	};
	/** A new size, said aloud; one that is the same as now writes nothing, so undo has no empty step. */
	const resizeTo = (to: Sized) => {
		setSpoken(sizeLabel(to));
		if (!sameSized(to, sized)) set(attrsOf(to));
	};
	/**
	 * The size a width on the screen makes, in the unit the picture keeps (px when it has none): a share of the column, or px up to what shows of the
	 * picture, where it is its own size again.
	 */
	const sizedAt = (px: number, column: number): Sized => {
		const unit: Unit = sized?.unit ?? "px";
		if (unit === "%")
			return {
				unit,
				value: clamp(Math.round((px / column) * 100), Math.ceil((Math.min(MIN_WIDTH, column) / column) * 100), 100),
			};
		const most = Math.floor(Math.min(column, own?.width ?? column));
		const value = Math.round(clamp(px, Math.min(MIN_WIDTH, most), most));
		return value >= most ? null : { unit, value };
	};
	const resize = (side: "left" | "right") => (event: React.PointerEvent) => {
		const measured = box.current?.getBoundingClientRect();
		if (!measured) return;
		event.preventDefault();
		event.stopPropagation();
		const startX = event.clientX;
		const column = bodyWidth() ?? measured.width;
		// A picture in the middle grows on both sides, so the corner under the pointer moves half of what the width does: it follows the pointer.
		const pull = align === "center" ? 2 : 1;
		const at = (clientX: number) =>
			sizedAt(measured.width + pull * (side === "right" ? clientX - startX : startX - clientX), column);
		const move = (next: PointerEvent) => setDragged({ to: at(next.clientX) });
		const finish = (keep: boolean) => (last: PointerEvent | KeyboardEvent) => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("keydown", esc);
			setDragged(null);
			// A corner pressed and let go where it was is no resize: it writes nothing.
			if (keep && "clientX" in last && last.clientX !== startX) resizeTo(at(last.clientX));
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
		const column = bodyWidth();
		const drawn = box.current?.getBoundingClientRect().width;
		if (!column || !drawn || !own) return;
		const step = (event.key === "ArrowRight" ? 1 : -1) * KEY_STEP[sized?.unit ?? "px"];
		if (sized?.unit === "%") return resizeTo(sizedAt(((sized.value + step) / 100) * column, column));
		// Its own size is as big as it gets.
		if (sized === null && step > 0) return;
		// A width in px steps from the width it keeps, which can be wider than this screen's body; none steps from what is drawn.
		const now = sized ? Math.min(sized.value, own.width) : Math.floor(drawn);
		const value = clamp(now + step, Math.min(MIN_WIDTH, own.width), own.width);
		resizeTo(value >= own.width ? null : { unit: "px", value });
	};
	const shownSized = dragged ? dragged.to : sized;
	const drawnAt =
		size &&
		imageSize(size, {
			crop: data.crop,
			rotate: data.rotate,
			width: shownSized?.unit === "px" ? shownSized.value : undefined,
		});
	const width: BlockWidth | undefined =
		shownSized?.unit === "%" ? `${shownSized.value}%` : drawnAt ? `${drawnAt.width}px` : undefined;

	return (
		<NodeViewWrapper data-block="image">
			<Stack gap={8}>
				<Inline justify={JUSTIFY[align]}>
					<BlockBox
						ref={box}
						width={width}
						// Picked reads as picked whether the body is written or only read: with pictures one over the other, the line says whose bar it is (T133).
						selected={picked}
						measure={dragged ? sizeLabel(dragged.to) : undefined}
						spoken={spoken}
						{...stop}
					>
						{url ? (
							<Image
								src={url}
								alt={data.decorative ? "" : (data.alt ?? "")}
								ratio="auto"
								radius="md"
								loading="eager"
								frame={frame}
								// Its place is held before it is in: what stands under it does not move when it comes (T126).
								shape={drawnAt ? drawnAt.width / drawnAt.height : null}
								// The whole picture, whatever the file says of its size: a size that is off leaves a sliver of ground, not a cut picture.
								fit="contain"
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
						{picked && !editable && url && (
							// Read-only (an archived entry, one in the trash): nothing changes the picture, but what the entry says of it can still be read. The
							// settings card opens with its fields read-only (T130; read-only keeps the ways to read, 2026-11-11 owner).
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
											<Stack gap={12}>
												<AltFields
													readOnly
													value={data.alt ?? ""}
													decorative={data.decorative === true}
													onChange={() => {}}
													onDecorative={() => {}}
													onEnter={() => media?.setCard(null)}
												/>
											</Stack>
										</PopoverContent>
									</Popover>
								</FloatingBar>
							</BlockBarPlace>
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
										{/* Edit is how the picture looks (its part, its turn, its size); settings are what the entry says of it (2026-11-10, owner). */}
										<FloatingBarButton label={t("editor.image.edit")} onClick={() => setEditing(true)}>
											<Edit aria-hidden />
										</FloatingBarButton>
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
									</FloatingBar>
								</BlockBarPlace>
								{CORNERS[align].map((corner) =>
									corner === "nw" || corner === "ne" ? (
										<ResizeCorner
											key={corner}
											corner={corner}
											onPointerDown={resize(corner === "nw" ? "left" : "right")}
										/>
									) : (
										<ResizeCorner
											key={corner}
											corner={corner}
											label={t(corner === "sw" ? "editor.image.resizeLeft" : "editor.image.resizeRight")}
											onPointerDown={resize(corner === "sw" ? "left" : "right")}
											onKeyDown={resizeKeys}
											onFocus={() => setSpoken(sizeLabel(sized))}
										/>
									),
								)}
							</>
						)}
					</BlockBox>
				</Inline>
				{captionField}
			</Stack>
			{editing && url && (
				<EditDialog
					src={url}
					size={size?.width && size.height ? { width: size.width, height: size.height } : null}
					crop={data.crop}
					rotate={data.rotate ?? 0}
					sized={sized}
					column={bodyWidth() ?? null}
					returnTo={() => editor.view.dom}
					onClose={() => setEditing(false)}
					onApply={({ crop, rotate, sized: to }) => {
						setEditing(false);
						set({ crop, rotate: rotate === 0 ? undefined : rotate, ...attrsOf(to) });
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
				{selected && (media ? !media.readOnly : editor.isEditable) && (
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
