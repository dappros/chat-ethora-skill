# Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `useXmppClient must be used within an XmppProvider` | `Chat` (or `useUnread`) rendered outside the provider | Wrap with `XmppProvider` (page or app root). |
| Two `wss://…/ws` connections / duplicate messages | different config objects for provider and chat, or `initBeforeLoad` mismatch, or your own `client.login()` | One memoized config for both; `initBeforeLoad: true`; no manual login. |
| `401` / "authorization token verify error" on login-with-email | app token sent without the `JWT ` prefix, or token of another app/server | Use `appToken` exactly as returned (`JWT eyJ…`). Re-run `ethora-admin.mjs use <appId>`. |
| Client JWT rejected (401/403 at `/v1/users/client`) | wrong/rotated app secret, wrong `appId` in payload, missing `data.type: 'client'`, expired `exp` | `verify-setup.mjs`; copy the secret from admin → Settings → API; `set-secret`. |
| `/v1/users/client` → `401 USER_NOT_FOUND` | user with that `userId` was never created in the app (the endpoint does not auto-create) | Sync via `/v1/users/batch` with the server token (templates do it lazily; `ensure-user.mjs` or `verify-setup.mjs --email` from the terminal). |
| Chat loads but no rooms | new app without rooms, or user not a member of any | Create the app with `createDefaultChat`, create rooms server-side and add members, or let users create rooms (`allowUsersToCreateRooms`). |
| Login screen appears although `jwtLogin` is set | token was `undefined` at first render and config not updated | Render `Chat` only once the token exists (templates do). |
| Next.js: `window is not defined` / hydration errors | chat rendered on the server | `'use client'` + `next/dynamic(..., { ssr: false })`. |
| Vite: `process is not defined` | Next/CRA-style env read in Vite | Use `import.meta.env.VITE_*`. |
| RN: app crashes at start after install | native peers not rebuilt / reanimated plugin missing | `pod install` + rebuild; `react-native-reanimated/plugin` in babel; not Expo Go. |
| RN: "two copies of React" | library added `react`/`react-native` as dependencies | Only the host app lists them. |
| RN device cannot reach `localhost:3000/api/ethora/token` | `localhost` is the phone | Use LAN IP / tunnel; set `EXPO_PUBLIC_ETHORA_TOKEN_ENDPOINT`. |
| XMPP connect timeout on self-hosted | wrong port or no TLS | Try `wss://host/ws` then `wss://host:5443/ws`; check certificate. |
| Registration from the terminal fails with captcha/cfToken | install requires Turnstile | Register at `https://app.chat.ethora.com/register`, then `ethora-admin.mjs login`. |
| Login says MFA required | account has TOTP | `ethora-admin.mjs login` prompts for the code; backup codes work too. |
| Push permission never appears (web) | `softAsk: true`, insecure origin, no VAPID | HTTPS/localhost, set `vapidPublicKey`, call `requestPermission()`. |
| Web: built-in email login form / `user={{email,password}}` says wrong credentials for users of YOUR app | `@ethora/chat-component` 26.9.x sends a hard-coded `appId` in its `/v1/users/login-with-email` body (bug in the package, not your config) | Use `jwtLogin` (recommended) or `customLogin` with your own `login-with-email` call that passes your `appId` — see web-integration.md §7. |
| "Connecting…" for ~30 s, then messages stay "sending…" and flip to "Not delivered" (they ARE on the server after a reload) | `<React.StrictMode>` wraps the chat: dev-mode double effects start the XMPP bootstrap twice (web SDK 26.9.x) | Remove `<StrictMode>` from `main.tsx` / `index.tsx`; Next.js `reactStrictMode: false`. Without it the connect takes ~2 s and messages get the double check immediately (verified on Ethora Cloud). |
| "Connecting…" never resolves | XMPP auth/connect failed | Enable `useStoreConsoleEnabled: true` and look for `[initBeforeLoad] ws auth/connect failed`; check `xmppSettings` and the TLS/ws endpoint (`verify-setup.mjs`). |
