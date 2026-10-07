# React Native integration — `@ethora/chat-component-rn` (Expo & bare RN)

Package: https://www.npmjs.com/package/@ethora/chat-component-rn · repo: https://github.com/dappros/ethora-chat-component-rn
Requirements: react >= 18, react-native >= 0.73 (tested on Expo SDK 53–57, New Architecture on).

## 1. Install

```bash
npm install @ethora/chat-component-rn
# required native peers — `expo install` picks versions matching the RN version (works in bare RN too)
npx expo install react-native-reanimated react-native-gesture-handler react-native-svg \
  @react-native-async-storage/async-storage @react-native-community/netinfo react-native-get-random-values
# media features (optional peers, but every real app wants them)
npx expo install expo-audio expo-video expo-clipboard expo-document-picker expo-image-manipulator \
  expo-image-picker expo-media-library expo-file-system expo-font expo-secure-store expo-blur expo-haptics
# optional: faster encrypted cache
npx expo install react-native-mmkv
```

Bare RN without Expo modules: `npx install-expo-modules@latest` first, or skip the `expo-*` list (pickers/playback then no-op).

Native rebuild after installing peers:
- Expo: `npx expo prebuild` (if `ios/`/`android/` exist) then `npx expo run:ios` / `run:android`. Expo Go does **not** work (native modules).
- Bare: `cd ios && pod install && cd ..`, then `npx react-native run-ios` / `run-android`.

Reanimated: make sure `react-native-reanimated/plugin` is in `babel.config.js` (Expo adds it via `babel-preset-expo`) and `react-native-gesture-handler` is imported at the app entry (`index.js` / `app/_layout.tsx`) before anything else.

## 2. Screen

Template: `assets/templates/rn/EthoraChatScreen.tsx` (+ `ethora.config.ts`).

- **React Navigation**: `<Stack.Screen name="Chat" component={EthoraChatScreen} />`. For a tab that stays mounted while hidden pass `isVisible={useIsFocused()}` so unread counts stay right.
- **Expo Router**: `app/chat.tsx` (or `app/(tabs)/chat.tsx`) → `export { default } from '../src/EthoraChatScreen';`.
- Wrap the screen in `SafeAreaView` (template does) and let it `flex: 1`.

`XmppProvider` placement: around the screen is fine for one chat screen. For unread badges on a tab bar or chat in several screens, put `XmppProvider config={config}` in the root layout/App and keep `<Chat config={config} />` in the screen (same memoized config object; `initBeforeLoad: true`).

## 3. Config (note the RN differences)

```ts
const config = {
  appId: ETHORA.appId,
  customAppToken: ETHORA.appToken,           // "JWT eyJ…" with the JWT prefix
  baseUrl: 'https://api.chat.ethora.com',    // API root; legacy ".../v1" accepted
  xmppSettings: {
    devServer: 'xmpp.chat.ethora.com',       // RN: BARE HOST — the SDK builds wss://<host>/ws itself
    host: 'xmpp.chat.ethora.com',
    conference: 'conference.xmpp.chat.ethora.com',
  },
  initBeforeLoad: true,
  newArch: true,
  refreshTokens: { enabled: true },
  jwtLogin: { enabled: true, token: clientJwt },   // or userLogin / customLogin — see auth-modes.md
};
```

Other RN-specific knobs (full reference: `instructions.md` in the package): `dark: true | 'system'` + `darkColors`, `logout: { enabled: true, onAfterLogout }` (built-in Sign out item), `settings.{languages,changePassword}`, `reactions`, `e2ee`, `enableAudio`, `keyboardStickyInput` / `disableKeyboardAvoidingView` / `inputDockPaddingBottom` (when the host already handles the keyboard or a tab bar), `disableConnectionErrorOverlay`.

## 4. Env

- **Expo**: `.env` with `EXPO_PUBLIC_ETHORA_*` (write-env `--target expo`). Also add `EXPO_PUBLIC_ETHORA_TOKEN_ENDPOINT=https://<your backend>/api/ethora/token` — on a device `localhost` is the phone; use your machine's LAN IP or a tunnel for dev.
- **Bare RN**: `src/ethora.config.ts` with literals (write-env `--target rn`), or `react-native-config` if the project already uses it.
- Never put `ETHORA_APP_SECRET` in the app.

## 5. Auth on mobile

Same model as web: your backend signs a client JWT for the signed-in user → `jwtLogin`. The screen template fetches it from `ETHORA.tokenEndpoint` with your session header. For a demo without a backend use `scripts/client-jwt.mjs` and `EXPO_PUBLIC_ETHORA_DEV_CLIENT_JWT` (dev only).

Logout: `const logout = useLogout(); await logout();` **before** clearing your own session (it also releases push registrations).

## 6. Push (optional)

The SDK does not mint tokens. Get one with `expo-notifications` or `@react-native-firebase/messaging` and either return it from `config.pushNotifications.getPushTokens` or call `registerPushToken(token)`; hand tapped notifications to `handlePushPayload(data)`. Sender keys (APNs .p8 / Firebase service account) are uploaded in the admin panel → app → Settings → Push.

## 7. Checklist

1. `node scripts/verify-setup.mjs --user-id <id> --email <email>` passes.
2. Native build runs on a simulator/device (not Expo Go).
3. The chat screen shows the room list and sends a message.
4. Metro logs show one XMPP connection; no "two copies of React" error (don't add `react`/`react-native` as dependencies of a library).
