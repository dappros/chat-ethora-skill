---
name: ethora-skill
description: Integrate Ethora chat into a React (web) or React Native (Expo / bare) app, or scaffold a new app with chat built in. Installs @ethora/chat-component or @ethora/chat-component-rn, wraps the app in XmppProvider, creates the chat page/screen, signs into the Ethora admin (app.chat.ethora.com) from the terminal to create/select an app and fetch its credentials, wires the "user without login" client-JWT flow with a backend token route, supports self-hosted Ethora servers, and verifies the setup. Use this whenever someone mentions Ethora, @ethora/chat-component(-rn), api.chat.ethora.com, app.chat.ethora.com, "add chat to my app", in-app messaging/chat rooms for a React or RN app, XmppProvider, or wants chat with their own users logged in automatically — even if they don't say "Ethora".
---

# Ethora chat integration

Goal: the user ends with a working chat in their app in minutes, with their own users signed in automatically. You do the legwork: detect the project, install the right package, place the component, get credentials from the Ethora admin in the terminal, write config, wire auth, verify.

Paths in this file are relative to the skill directory. Scripts are plain Node (>= 18), no installs needed: run them with `node <skill>/scripts/<name>.mjs`. They keep state in `~/.ethora/` (override with the `ETHORA_HOME` env var).

## 0. Orient

1. Run `node scripts/detect-project.mjs <projectDir> --json`. It tells you platform (web / react-native / none), framework (vite, next, cra, expo, bare-rn), router, package manager, env convention, entry files and existing pages/screens.
2. Decide the track:
   - **Existing app** → continue below.
   - **No project** (`platform: none`) or the user wants a new app → scaffold first, then continue as "existing":
     - web: `npm create vite@latest <name> -- --template react-ts` (or Next if they ask: `npx create-next-app@latest`)
     - mobile: `npx create-expo-app@latest <name>` (Expo is the fastest path; bare RN only if they insist)
   - **Backend-only repo** → only section 4 (token route) applies.
3. Read the matching reference now, it is short and has the exact install/placement rules:
   - web → `references/web-integration.md`
   - React Native → `references/rn-integration.md`

Keep the user in the loop with short confirmations, but do not stop for things you can decide (package manager, file names, where templates go). Stop and ask (AskUserQuestion when available) only for the four real decisions: which page/screen, Cloud vs self-hosted, account (login/register), which app.

## 1. Install the SDK

- web: `@ethora/chat-component` (+ import `@ethora/chat-component/dist/main.css` once)
- RN: `@ethora/chat-component-rn` + required native peers via `npx expo install …` (list in the RN reference), then `pod install` / rebuild. Expo Go cannot run it.

Use the detected package manager. If the package is already installed, just note the version.

## 2. Where does the chat go?

Ask: *existing page/screen or a new one?* Offer the list from `detect-project` (existing pages) plus "new route /chat". Then:

- Copy templates and adapt names/paths:
  - web: `assets/templates/web/ethora.config.ts`, `EthoraChat.tsx`, `ChatPage.tsx` (Next: also `EthoraChatNext.tsx`, and use it instead of importing `EthoraChat` directly). Fix the env prefix in `ethora.config.ts` for Next/CRA (literal `process.env.NEXT_PUBLIC_…` reads).
  - RN: `assets/templates/rn/ethora.config.ts`, `EthoraChatScreen.tsx`.
- Register the route/screen in their router (react-router `<Route>`, Next `app/chat/page.tsx`, Expo Router `app/chat.tsx`, React Navigation `Stack.Screen`). Add a link/tab so it is reachable.
- Give the container a real height (web: `100vh`/flex; RN: `flex: 1`).

## 3. Wrap with `XmppProvider`

`Chat` must live inside `XmppProvider`. Two valid placements — pick with the user's usage in mind, don't ask unless it matters:
- **page-level** (template default): simplest, chat only on that page.
- **app root**: when they want unread badges elsewhere, chat on several pages, or push. Move `XmppProvider config={config}` to `main.tsx`/`App.tsx`/root layout (client component in Next) and keep `<Chat config={config} />` in the page.

Rules that prevent the classic bugs: one memoized `config` object passed to **both** provider and chat; `initBeforeLoad: true`; never call the XMPP client login yourself. (Templates already comply.)

**React StrictMode must not wrap the chat (web SDK 26.9.x).** StrictMode's double-invoked effects start the XMPP bootstrap twice: the first connect takes ~30 s instead of ~2 s and sent messages stay at "sending…" then show "Not delivered" although the server stored them (verified live). Vite/CRA templates wrap the app in `<StrictMode>` in `main.tsx` — remove it (or move it so it does not enclose the chat page); Next.js: `reactStrictMode: false` in `next.config`. Tell the user why.

## 4. Which API?

Ask: **Ethora Cloud** (default, `https://api.chat.ethora.com`, admin at https://app.chat.ethora.com) or **self-hosted** (customers who run their own Ethora server — same API, their hostnames). For self-hosted read `references/self-hosted.md` and pass `--api <origin>` to the admin script in the next step.

## 5. Credentials from the Ethora admin — in the terminal

The admin panel is an API client; `scripts/ethora-admin.mjs` does the same from the terminal (login with MFA support, registration, list/create apps, profile). It needs an interactive terminal for passwords, so **the user runs it**, not you:

```bash
node <skill>/scripts/ethora-admin.mjs setup            # Cloud
node <skill>/scripts/ethora-admin.mjs setup --api https://api.chat.acme.com   # self-hosted
```
It needs a real TTY, so the `!` prefix in Claude Code does not work for it: ask the user to run it in a separate terminal window. The flow asks: account exists? (login / register) → pick an existing app or create one → saves the profile to `~/.ethora/profiles.json` (same format as `npx @ethora/setup`, so either tool works).

Non-interactive alternative, if the user prefers to hand you the values: `ETHORA_PASSWORD=… node scripts/ethora-admin.mjs setup --email <email> --app <appId>` (or `--create-app "<name>"`, `--register --first-name … --last-name …`, `ETHORA_MFA_CODE=…`). Never echo the password back and never write it anywhere.

Afterwards run (non-interactive, you can do it): `node scripts/ethora-admin.mjs profile --json` to read appId / endpoints, and check `appSecret` is present. If the API did not return the secret, the user copies it from admin → app → Settings → API → Secret and runs `node scripts/ethora-admin.mjs set-secret <secret>`.

Individual commands exist too (`login`, `register`, `apps`, `create-app --name`, `use <appId>`, `logout`) — see `references/admin-api.md` for what each endpoint does.

## 6. Write the config into the project

```bash
node scripts/write-env.mjs --target vite|next|cra|expo|rn --dir <projectDir>
node scripts/write-env.mjs --target backend --dir <backendDir>     # ETHORA_APP_ID / ETHORA_APP_SECRET / ETHORA_API_URL
```
It merges keys into `.env.local` / `.env` / `src/ethora.config.ts`, adds them to `.gitignore`, and never writes the secret with a public prefix. The templates read exactly these keys.

## 7. Auth — "my users should be logged in automatically"

Read `references/auth-modes.md` (short) and implement the **client JWT** flow unless the user asks otherwise:

1. Backend route `GET /api/ethora/token` → signs `{ data: { type: 'client', appId, userId } }` HS256 with the app secret and ensures the user exists in the app (`/v1/users/batch`). Templates: `assets/templates/backend/ethora-token.js` + `express-route.js`, or `next-route.ts` for Next. Hook `getCurrentUser`/`req.user` to their real session.
2. Frontend (already in the templates) fetches the token and renders `Chat` with `jwtLogin: { enabled: true, token }`.
3. `userId` must be the app's own stable id for the user — same on web and mobile.

No backend in this project? Offer, in this order: the Vite dev plugin (`assets/templates/web/vite-dev-token-plugin.ts`), a pre-signed dev token (`scripts/client-jwt.mjs --user-id dev-user-1 --expires 7d` → `write-env.mjs --dev-jwt`), or the built-in login/registration form (`customAppToken` only, no `jwtLogin`). Always say which one is dev-only.

## 8. Verify, then run

```bash
node scripts/verify-setup.mjs --user-id <someUserId> --email <email>
```
Checks API reachability, that the app token matches the app, that a client JWT signed with the stored secret is accepted by `/v1/users/client` (creating the user if needed), and that the XMPP host answers. Fix what it reports before starting the app.

Then start the dev server / native build and ask the user to open the chat page. Expect a "Connecting…" spinner for a couple of seconds on the first load (JWT exchange, rooms, XMPP auth); 30 s means StrictMode is still on. A freshly created app has a "Main chat" room; sending a message there is the success criterion. Common failures and fixes: `references/troubleshooting.md`.

## 9. Finish

Tell the user, briefly: what was installed, which files were created/changed, where the credentials live (`~/.ethora/profiles.json`, env files — gitignored), how auth works and what is dev-only, and the next optional steps (room provisioning from their backend, push notifications, theming via `colors`/`colorScheme`/`dark`, single-room mode with `roomJID` + `disableRooms`). Admin panel for the app: `https://app.chat.ethora.com/app/admin/apps/<appId>` (Cloud).

## Reference map

| Need | File |
| --- | --- |
| Web install, provider placement, routers, env, frontend-only options | `references/web-integration.md` |
| RN peers, native rebuild, screens, env, push | `references/rn-integration.md` |
| Auth modes, client JWT payload, user sync, rooms, token glossary | `references/auth-modes.md` |
| Endpoints behind the admin panel, profile file format | `references/admin-api.md` |
| Self-hosted servers | `references/self-hosted.md` |
| Errors → fixes | `references/troubleshooting.md` |
| Official docs | https://docs.ethora.com · https://api.chat.ethora.com/api-docs/ · package READMEs on npm |
