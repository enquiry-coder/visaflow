# Expo App

## Tech Stack

Expo 57, React Native 0.86, Expo Router 57, TanStack Query 5, NativeWind 4, Supabase (tinbase), TypeScript strict, lucide-react-native

## Quick Reference

### File Locations

All paths relative to project root:

| Type                | Location                        | Export                        |
| ------------------- | ------------------------------- | ----------------------------- |
| Screens (protected) | `app/(app)/*.tsx`               | default                       |
| Screens (public)    | `app/(auth)/*.tsx`              | default                       |
| Components          | `components/*.tsx`              | named → `components/index.ts` |
| Hooks               | `src/hooks/*.ts`                | named → `src/hooks/index.ts`  |
| Providers           | `src/providers/*.tsx`           | named                         |
| Supabase client     | `src/db/client.ts`              | `supabase`                    |
| App context         | `src/providers/AppProvider.tsx` | `useApp` (provides `client`)  |
| Generated types     | `src/db/types.ts`               | `Database` (GENERATED)        |
| Migrations          | `../supabase/migrations/*.sql`  | SQL — repo root, not mobile/  |
| Seed data           | `../supabase/seed.sql`          | SQL                           |

### Client Architecture

A single Supabase client, reached through React context:

- `src/db/client.ts` — `supabase` created from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `src/providers/AppProvider.tsx` — `useApp()` returns `{ client }`
- **In screens/hooks:** `const { client } = useApp()` then `client.from('table').select('*')`
- **For auth:** use `useAuth()` hook (wraps `client.auth` in React Query mutations)
- **Editor preview is pre-authenticated:** the editor's in-sandbox database provisions a demo user (`demo@rapidnative.com`) at boot and the db client signs it in automatically — build auth-gated screens normally; the preview lands on the signed-in UI with a real email, `auth.uid()`/RLS work, and real sign-in/up flows still work for other accounts
- There is no mock adapter and no adapter switching. The database is real in every environment, so
  what you see in the preview is what ships.

### UI Components

Use React Native primitives with NativeWind styling:

| Category   | Components                                                   |
| ---------- | ------------------------------------------------------------ |
| Layout     | `View`, `SafeAreaView` (from react-native-safe-area-context), `KeyboardAvoidingView` (wrap per-screen on pages with inputs) |
| Typography | `Text`                                                       |
| Forms      | `TextInput`, `Pressable`, `TouchableOpacity`                 |
| Lists      | `FlatList`, `ScrollView`, `SectionList`                      |
| Feedback   | `ActivityIndicator`                                          |
| Images     | `Image`, `ImageBackground`                                   |
| Icons      | Import from `lucide-react-native`                            |

### Rules

**Do:**

- Access the client via `useApp().client`
- Use `useAuth()` for sign in/up/out — it handles React Query cache invalidation
- Use React Native components with NativeWind `className` for all styling
- Use semantic color classes (`bg-background`, `text-foreground`, etc.)
- Check `{ error }` from all db operations, and surface it — an unchecked `error` is an invisible failure
- Keep one write path per entity. If a helper like `createReview()` already exists, call it from the screen instead of inlining a second `client.from('reviews').insert(...)`; parallel paths drift and only one of them gets fixed
- Use query keys: `['resource', userId]`
- Include `id` on insert; let `created_at` default. Do not set `updated_at` by hand — a trigger maintains it
- Export from index.ts
- Wrap form screens (screens with `TextInput`s) in `KeyboardAvoidingView` (`behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`, `style={{ flex: 1 }}`) with a `ScrollView` inside (`keyboardShouldPersistTaps="handled"`, `paddingBottom: 128`) so inputs remain reachable when the keyboard opens
- Use `useCallback` for FlatList handlers
- Use `.limit(50)` for lists
- **MANDATORY: database changes are SQL migrations — nothing else.** Call `db_migration_new` with the SQL.
  Never hand-write TypeScript schema or seed files: `src/db/types.ts` is generated from the applied
  migrations, and seed rows live in `supabase/seed.sql`.
  - New table → ONE migration containing `create table`, `alter table ... enable row level security`,
    and at least one `create policy`. RLS with no policy makes every query return zero rows, so the
    app looks broken with no error anywhere.
  - **Table and column names: lowercase snake_case, never a SQL reserved word.** `order`, `user`,
    `group`, `limit`, `desc`, `check`, `default`, `table`, `column`, `references`, `cast`, `offset` are
    keywords: bare, `order integer` is a syntax error that fails the whole migration and every file
    after it; quoted, every later query and migration has to remember the quotes. Name the thing
    instead — `sort_order`, `user_id` / `owner_id`, `group_name`, `max_limit`, `description`. camelCase
    is just as bad: Postgres folds a bare `firstName` to `firstname` and PostgREST is case-sensitive,
    so `.eq('firstName', …)` is a 400 — write `first_name`. `db_migration_new` rejects both.
  - **Write idempotent DDL, and order statements by dependency.** The real database may already hold
    part of the schema (a rebuild, a re-run, a converted project), so a bare `create table` /
    `add column` / `create policy` throws "already exists" (42P07 / 42701 / 42710) and aborts the
    whole migration chain, leaving every screen empty. Always use `create table if not exists`,
    `create index if not exists`, `add column if not exists`, and `drop policy if exists <name> on
    <table>;` on the line before each `create policy` (Postgres has no `create policy if not exists`).
    Create a referenced (FK-parent) table, and any table a policy reads from, BEFORE the table or
    policy that references it — otherwise a from-scratch build fails with `relation "…" does not exist`.
  - Owner-scoped data → `user_id uuid default auth.uid() references auth.users(id) on delete cascade`
    with policies like `using (auth.uid() = user_id)`. Add an index on every foreign key — Postgres
    does not create one, so the lookups seq-scan.
  - `updated_at` needs a before-update trigger, or it keeps its insert value forever.
  - Read the schema with `db_tables` / `db_describe` / `db_sql` before changing it; never guess what exists.
  - **Never write a query against a column you have not confirmed exists.** Inventing plausible column
    names (`safe_dish`, `is_anonymous`, `notes`) produces a PostgREST 400 at runtime —
    `Could not find the 'x' column of 'y' in the schema cache` (PGRST204) — which, combined with any
    of the silent-failure patterns below, shows the user nothing at all. `db_describe` first, then
    write the query.
  - **A column existing in the deployed database is not enough — the migration must create it.**
    `supabase/migrations/` is what provisions every *other* environment (preview sandboxes, fresh
    checkouts, rebuilds). If a column was added out-of-band, the app works in one environment and
    throws PGRST204 in all the rest, which reads as "it worked yesterday". Whenever you write a
    column, confirm a migration creates it; if not, add one (`add column if not exists`, so it is a
    no-op where the column is already present).
  - Keep `supabase/seed.sql` writing the columns the UI actually reads. Seeding a legacy column the
    screens no longer render leaves the preview looking empty for no visible reason.
  - **If `client.from('x')` types every column as `never`, stop.** That means `src/db/types.ts` is stale
    or malformed against the migrations, not that the query is wrong. Regenerate the types. Casting past
    it (`client as any`) buries a real drift between the code and the database, and the query still
    fails at runtime.

**Don't:**

- Import the client directly in screens — use `useApp().client`
- Call `client.auth.*` directly in screens — use `useAuth()` hook
- Use `StyleSheet.create()`
- Hardcode colors
- Write unitless arbitrary classNames — `h-[20]` is invalid and silently does nothing; always include the unit (`h-[20px]`) or use a scale class (`h-5`)
- Auto-redirect signed-in users off auth screens (`if (user) router.replace('/')`). The editor preview is always signed in, so the redirect makes login/signup screens impossible to open. If needed, gate it off in preview modes: `process.env.EXPO_PUBLIC_RAPIDNATIVE_MODE !== 'designer' && process.env.EXPO_PUBLIC_RAPIDNATIVE_MODE !== 'staging'`
- Use `any` types
- Expose raw errors to users
- Use `Alert.alert` for anything the user needs to see — **it is a no-op on web**, and the preview is Expo Web. See below.

### Silent failure — why "I click the button and nothing happens"

These all compile, ship, and produce a dead button with nothing in the UI and nothing in the console.
They are the most common bug class in generated apps. Do not write them.

- **Reaching the client through a global.** `const supabase = (globalThis as any).__RAW_SUPABASE__`
  is never assigned by this template, so it is always `undefined` and every handler built on it is
  dead code. There is exactly one client and it is `useApp().client`. Never invent a global handle,
  never stash the client on `globalThis`, never read one you did not write.
- **`Alert.alert` as the only feedback.** `Alert` from `react-native` does nothing on web. A submit
  handler whose failure path is `Alert.alert('Error', msg); return;` is completely invisible in the
  preview — the button appears inert. Render failures into on-screen state (an error `<Text>` under
  the form) so they show up on every platform. If you genuinely need a modal, branch on
  `Platform.OS === 'web'` and use `window.alert` / a custom in-app dialog there.
- **Guard clauses around things that always exist.** `if (!client) return;` / `if (!supabase) return;`
  turns what should be a loud crash into a no-op. Only guard on values that are genuinely optional
  (an unauthenticated `user`, an empty input) — and when you do, `setError(...)` on the way out.
- **Swallowing catches.** `catch {}` and `catch (e) { console.error(e) }` hide the failure from the
  user. Every `catch` in an event handler must set visible error state, not just log.
- **Unresetting loading flags.** Every early `return` inside a submit handler must clear the
  spinner state it set, or use `finally`. A stuck spinner reads as a frozen app.

### Banned (will crash the app or break the web preview)

- **ORMs and schema-as-code** — no Prisma, no Drizzle, no `defineTable`. The schema is SQL in `supabase/migrations/`, applied to a real Postgres. If an ORM-shaped solution feels natural, write the SQL instead.
- **Reading picker URIs with `expo-file-system` on web** — `ImagePicker` returns a `blob:`/`data:` URI on web, and `FileSystem.readAsStringAsync` cannot read either, so every upload throws. Blob URLs also carry no file extension, so `uri.split('.').pop()` yields the whole URL instead of `jpg`. Branch: on web use `await (await fetch(uri)).blob()` and take the extension from `blob.type`; on native keep the `FileSystem` base64 path.
- **Native-only packages** — `react-native-webrtc`, `react-native-incall-manager`, `@react-native-firebase/*` and similar break the web preview the moment they're imported. Either use a web-supported alternative (browser `RTCPeerConnection`, `firebase` web SDK) or gate native code behind `Platform.OS` with a real web fallback.
- **Rewriting read-only files** — `src/db/client.ts`, `src/db/types.ts` (generated), `src/providers/AppProvider.tsx`, `src/providers/ThemeProvider.tsx`, `src/hooks/useAuth.ts`, the root `app/_layout.tsx`, and `package.json` ship complete from the scaffold. Add new code around them, never regenerate them. Never pass `value={...}` to `<ThemeProvider>` — it takes no props. Exception for `package.json`: ADDING a dependency is allowed (add-only, never remove or change existing entries) — the package must work on Expo Web (prefer `expo-*` modules) and be pinned to its Expo SDK 57-compatible version, never `latest`. The root `app/_layout.tsx` already loads Inter + JetBrains Mono (the `font-*` classes) and waits for them outside preview; to add another family, load it in `app/(app)/_layout.tsx` with `useFonts` from `expo-font` and, outside preview (`EXPO_PUBLIC_RAPIDNATIVE_MODE` is neither `designer` nor `staging`), render nothing until `fontsLoaded` — a screen mounted before its font loads keeps the fallback-font text layout on React Native 0.86 and clips at the right edge.
- **Hooks at module top level** — `const queryClient = useQueryClient();` outside a component crashes with "Invalid hook call". Hooks belong inside the component or another hook.
- **Hallucinated icon names** — only emit icons that actually exist in `lucide-react-native`. `MessageIcon` and `RecordIcon` do NOT exist (use `MessageCircleIcon` / `DiscIcon`). When unsure, pick the closest icon that is on the approved list.
- **Malformed `cssInterop` icon config** — to color a `lucide-react-native` icon via `className`, the `className` value must be the nested object `{ target: 'style', nativeStyleToProp: { color: true } }`, registered once per icon at module top level:
  `cssInterop(FlameIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });`.
  Do NOT flatten it to `{ className: 'style', nativeStyleToProp: { color: true } }`. Pulling `nativeStyleToProp` up to the top level — which happens most often when you hoist the config into a shared `const ICON_STYLE = ...` and drop the `className:` nesting — makes nativewind read `nativeStyleToProp` as its own prop with no `target` and red-screens the entire route with `Cannot read property 'split' of undefined`. If you factor the config into a constant, keep the exact nested shape: `const ICON_STYLE = { className: { target: 'style', nativeStyleToProp: { color: true } } } as const;`.
- **Provider/consumer asymmetry** — every method called on a context (`useWebSocket().sendMessage(...)`) must be declared on the context type, included in the provider `value`, AND stubbed in the no-op fallback. Adding the consumer side alone is a runtime crash.
- **Template artifacts in source files** — never let chat-frame fragments like ` `<CodeProject> ``or stray` ```tsx ` markers end up inside `.ts` / `.tsx` files. The last line of every file must be valid syntax.

## Behavior

- Use TodoWrite for multi-step tasks
- Conventional commits: `type(scope): description`
- Read files before editing
- Prefer editing over creating new files
- Reference `.claude/skills/` for domain-specific patterns
