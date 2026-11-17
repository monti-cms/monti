import { AiFailed, AiWorking, Inline, Text, TextButton } from "@monti-cms/ui";
import { Renew, Spark } from "@monti-cms/ui/icons";
import { useAdmin } from "../operations/admin-context";
import { toWhatStands, useFocusHandOff } from "../screens/frame/focus-hand-off";
import type { FillState } from "./use-fill";

/**
 * "✦ Fill" of one place, the same wherever a place has one (a field's label row, a picture's words, its caption): "✦ Fill" while it is
 * empty, "↻ Again" once it holds something, and while the model is asked, "Generating · Stop" in its place. Once a fill is in, the line
 * is "Discard · ↻ Again" (doc 10, principle 1): no name for what the fill did, no "accept". Discarding puts back what the place held
 * before; stopping leaves the place as it was. A pointer's press leaves the caret where it was; a key's press hands the focus to "Stop",
 * and back to what stands when the work ends (`useFocusHandOff`).
 */
export function FillAction({
	state,
	held,
	filled,
	name,
	onFill,
	onStop,
	onDiscard,
	after,
}: {
	state: FillState;
	/** The place holds something: the button fills it again. */
	held: boolean;
	/** What the place holds is what a fill put in (`state.filled`, untouched since): the line can discard it. */
	filled: boolean;
	/** The place's name, for a screen reader: "Fill Summary". */
	name?: string;
	onFill: () => void;
	onStop: () => void;
	onDiscard: () => void;
	/**
	 * Where the focus goes when the whole spot goes with the work (a caption's button shows only while the caret is in the caption): the
	 * box the fill writes to. Found from the spot while it is still in the page.
	 */
	after?: (spot: HTMLElement) => HTMLElement | null | undefined;
}) {
	const { t } = useAdmin();
	// Back to the fill button when the work ends ("↻ Again" after a fill, past "Discard"), to "Stop" while it works.
	const keep = useFocusHandOff((place) =>
		toWhatStands(place, ["[data-tone=proposal]", "button"], after && (() => after(place))),
	);
	// A press keeps the caret in the place it is about.
	const keepCaret = (event: React.MouseEvent) => event.preventDefault();
	return (
		<Inline as="span" ref={keep} gap={6} align="baseline">
			{state.working ? (
				<AiWorking size="caption" onStop={onStop} />
			) : (
				<>
					{filled ? (
						<>
							<TextButton
								variant="underline"
								quiet
								size="caption"
								aria-label={name ? t("fill.discardName", { field: name }) : undefined}
								onMouseDown={keepCaret}
								onClick={onDiscard}
							>
								{t("fill.discard")}
							</TextButton>
							<Text as="span" variant="caption" tone="subtle" aria-hidden="true">
								·
							</Text>
						</>
					) : null}
					<TextButton
						tone="proposal"
						size="caption"
						aria-label={name ? t(held ? "fill.againName" : "fill.name", { field: name }) : undefined}
						onMouseDown={keepCaret}
						onClick={onFill}
					>
						{held ? <Renew aria-hidden /> : <Spark aria-hidden />}
						{t(held ? "fill.again" : "fill.fill")}
					</TextButton>
				</>
			)}
		</Inline>
	);
}

/** Why the last fill of a place gave nothing, under the place: the one failure line of AI work, with "Try again" when asking again can go. */
export function FillFailed({
	state,
	onRetry,
	align,
}: {
	state: FillState;
	onRetry: () => void;
	/** A caption's line follows the caption's own alignment. */
	align?: "start" | "center" | "end";
}) {
	if (!state.failed) return null;
	return (
		<AiFailed size="caption" align={align} onRetry={state.retry ? onRetry : undefined}>
			{state.failed}
		</AiFailed>
	);
}
