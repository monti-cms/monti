# @monti-cms/admin

Monti's admin screens. They are built from `@monti-cms/ui` parts and reach the server only through operations: `useOperation` and `useRead` call
the admin API through a `Transport`, and no screen calls `fetch` (the lint allows it only in `src/operations`).

```tsx
import { httpTransport, MontiAdmin } from "@monti-cms/admin";

<MontiAdmin transport={httpTransport("/admin/api")} siteName="example.dev" />;
```

`siteName` and `language` are what the admin shows until the settings hold a name (settings › site) and a screen language (settings › admin); from
then on the saved ones are shown, on the sign-in screen too.

Now: the login screen (first admin, sign-in, the lock, GitHub) and the frame (the sidebar from the schema and `frame.counts`, the screen mode, the
schema banners). The other screens come with their feature docs (`docs/design/features`).

## Storybook

```sh
pnpm --filter @monti-cms/admin storybook   # port 6007
```

Every screen story runs a whole site in the browser: Postgres on PGlite, the core's real operations and the real admin API
(`.storybook/pglite-site.ts`). A story puts its data in through operations, so it cannot drift from what the code does.
