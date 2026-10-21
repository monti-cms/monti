/**
 * Which templates of a backup a restore adds. The site keeps the templates it was seeded with, so a template whose id the site already has is skipped, and so is
 * one whose name it has (names are unique, ignoring case); the first of two archive templates with one name wins. Both the preview and the store use this, so they agree.
 */
export function splitTemplates(existing, incoming) {
    const ids = new Set(existing.map((template) => template.id));
    const names = new Set(existing.map((template) => template.name.toLowerCase()));
    const add = [];
    const skipped = [];
    for (const template of incoming) {
        const reason = ids.has(template.id) ? "id" : names.has(template.name.toLowerCase()) ? "name" : null;
        if (reason) {
            skipped.push({ id: template.id, name: template.name, reason });
            continue;
        }
        ids.add(template.id);
        names.add(template.name.toLowerCase());
        add.push(template);
    }
    return { add, skipped };
}
