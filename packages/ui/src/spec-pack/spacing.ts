import type { SpacingClassTable } from "../spec/spacing";
import {
	GAP,
	MARGIN_LEFT,
	MARGIN_TOP,
	PADDING_BOTTOM,
	PADDING_LEFT,
	PADDING_RIGHT,
	PADDING_TOP,
} from "../tokens.generated";

/** Monti's class for each spacing step, from the design system's tokens (`pnpm gen:tokens`). */
export const spacing: SpacingClassTable = {
	gap: GAP,
	paddingStart: { column: PADDING_TOP, row: PADDING_LEFT },
	paddingEnd: { column: PADDING_BOTTOM, row: PADDING_RIGHT },
	marginBefore: { column: MARGIN_TOP, row: MARGIN_LEFT },
};
