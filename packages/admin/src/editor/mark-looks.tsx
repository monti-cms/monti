import { useAdmin } from "../operations/admin-context";

/**
 * The site's marks' looks (doc 18): each mark's site component loads its own stylesheet (`<style href precedence>`, once), so the editor draws a colour
 * or a tooltip's words as the site does. They are drawn here once, out of sight, for that.
 */
export function MarkLooks() {
	const { marks } = useAdmin();
	return (
		<div hidden>{[...marks.values()].map(({ type, Site }) => (Site ? <Site key={type} mark={{ type }} /> : null))}</div>
	);
}
