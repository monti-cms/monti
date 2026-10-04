import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
/** Default plugin name tag. Created separately per check extension (`new PluginKey`) so they do not collide. */
export const textCheckPluginKey = new PluginKey("cmsTextCheck");
const EMPTY = { issues: [], decorations: DecorationSet.empty };
function decorate(doc, issues) {
    if (issues.length === 0)
        return DecorationSet.empty;
    return DecorationSet.create(doc, issues.map((issue) => Decoration.inline(issue.from, issue.to, { class: "cms-text-issue", "data-severity": issue.severity, "data-text-issue": issue.key }, { key: issue.key })));
}
/** Moves result positions along with document changes. Results that overlap or touch the changed range are dropped. */
export function mapIssues(issues, tr) {
    let current = issues;
    for (const map of tr.mapping.maps) {
        const changed = [];
        map.forEach((oldStart, oldEnd) => {
            changed.push([oldStart, oldEnd]);
        });
        if (changed.length === 0)
            continue;
        current = current.flatMap((issue) => {
            if (changed.some(([start, end]) => start <= issue.to && end >= issue.from))
                return [];
            const from = map.map(issue.from, 1);
            const to = map.map(issue.to, -1);
            return from < to ? [{ ...issue, from, to }] : [];
        });
    }
    return current;
}
const overlaps = (issue, range) => issue.from < range.to && issue.to > range.from;
function applyMeta(issues, meta) {
    if (meta.type === "clear")
        return [];
    if (meta.type === "remove") {
        const keys = new Set(meta.keys);
        return issues.filter((issue) => !keys.has(issue.key));
    }
    const kept = issues.filter((issue) => !meta.checkerIds.includes(issue.checkerId) || !meta.ranges.some((range) => overlaps(issue, range)));
    return [...kept, ...meta.issues].sort((a, b) => a.from - b.from || a.to - b.to);
}
/** The result covering that position (the shortest one). */
export function issueAt(state, pos, key = textCheckPluginKey) {
    const issues = key.getState(state)?.issues ?? [];
    let found = null;
    for (const issue of issues) {
        if (issue.from <= pos && pos <= issue.to && (!found || issue.to - issue.from < found.to - found.from))
            found = issue;
    }
    return found;
}
export function createTextCheckPlugin({ key = textCheckPluginKey, onIssueClick, } = {}) {
    return new Plugin({
        key,
        state: {
            init: () => EMPTY,
            apply(tr, value, _old, state) {
                const meta = tr.getMeta(key);
                if (!tr.docChanged && !meta)
                    return value;
                let issues = tr.docChanged ? mapIssues(value.issues, tr) : value.issues;
                if (meta)
                    issues = applyMeta(issues, meta);
                if (issues === value.issues)
                    return value;
                return { issues, decorations: decorate(state.doc, issues) };
            },
        },
        props: {
            decorations: (state) => key.getState(state)?.decorations ?? DecorationSet.empty,
            handleClick(view, pos, event) {
                if (!onIssueClick || event.button !== 0)
                    return false;
                // Open only when pressing on a decoration (underline). Pressing the empty space at the end of a line, which puts the cursor right after a result, does not open it.
                if (!(event.target instanceof Element) || !event.target.closest("[data-text-issue]"))
                    return false;
                const issue = issueAt(view.state, pos, key);
                if (issue)
                    onIssueClick(issue, view);
                // Move the cursor as usual.
                return false;
            },
        },
    });
}
export const textCheckIssues = (state, key = textCheckPluginKey) => key.getState(state)?.issues ?? [];
