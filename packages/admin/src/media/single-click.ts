/**
 * A click handler that takes only the first click of a double click. A folder opens on one click, so the second click of a double click lands
 * on whatever came under the pointer (a file of the folder just opened) and would open that too. A key's press counts as one (`detail` 0).
 */
export const singleClick =
	(handler: () => void) =>
	(event: { detail: number }): void => {
		if (event.detail > 1) return;
		handler();
	};
