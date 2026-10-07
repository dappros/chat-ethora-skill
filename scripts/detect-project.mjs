#!/usr/bin/env node
/**
 * detect-project.mjs — figure out what kind of project we are integrating into.
 *
 * Usage: node detect-project.mjs [projectDir] [--json]
 *
 * Prints a summary (and JSON with --json):
 *   platform   web | react-native | none | unknown
 *   framework  vite | next | cra | remix | expo | bare-rn | react-unknown | none
 *   router     react-router | next-app | next-pages | expo-router | react-navigation | none
 *   pm         npm | yarn | pnpm | bun
 *   typescript true/false, srcDir, entry candidates, env file convention, ethora package already installed
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const dir = resolve(args.find((a) => !a.startsWith('--')) || process.cwd());

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const has = (...p) => existsSync(join(dir, ...p));
const pkg = readJson(join(dir, 'package.json'));
const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
const dep = (n) => deps[n];

const result = {
  dir,
  hasPackageJson: !!pkg,
  name: pkg?.name || null,
  platform: 'unknown',
  framework: 'none',
  router: 'none',
  pm: 'npm',
  typescript: has('tsconfig.json'),
  srcDir: has('src') ? 'src' : '.',
  react: dep('react') || null,
  reactNative: dep('react-native') || null,
  expo: dep('expo') || null,
  ethoraWeb: dep('@ethora/chat-component') || null,
  ethoraRn: dep('@ethora/chat-component-rn') || null,
  envConvention: null,
  envFile: null,
  entryCandidates: [],
  pagesDir: null,
  notes: [],
};

if (!pkg) {
  result.platform = 'none';
  result.notes.push('No package.json: this is an empty directory or not a JS project. Offer to scaffold a new app (Vite React or Expo).');
} else {
  if (has('yarn.lock')) result.pm = 'yarn';
  if (has('pnpm-lock.yaml')) result.pm = 'pnpm';
  if (has('bun.lockb') || has('bun.lock')) result.pm = 'bun';

  if (dep('react-native') || dep('expo')) {
    result.platform = 'react-native';
    result.framework = dep('expo') ? 'expo' : 'bare-rn';
    if (dep('expo-router')) result.router = 'expo-router';
    else if (dep('@react-navigation/native')) result.router = 'react-navigation';
    result.envConvention = dep('expo') ? 'EXPO_PUBLIC_' : (dep('react-native-config') ? 'react-native-config' : 'config-file');
    result.envFile = dep('expo') ? '.env' : (dep('react-native-config') ? '.env' : 'src/ethora.config.ts');
    const appJson = readJson(join(dir, 'app.json'));
    if (appJson?.expo) result.notes.push(`Expo app "${appJson.expo.name}" (slug ${appJson.expo.slug}); newArchEnabled=${appJson.expo.newArchEnabled ?? 'default'}`);
    if (result.router === 'expo-router') {
      result.pagesDir = has('app') ? 'app' : (has('src', 'app') ? 'src/app' : null);
      result.notes.push('Expo Router: a new screen is a file under app/ (e.g. app/chat.tsx or app/(tabs)/chat.tsx).');
    }
    for (const c of ['App.tsx', 'App.js', 'index.js', 'index.tsx', 'app/_layout.tsx', 'src/App.tsx', 'src/app/_layout.tsx']) if (has(c)) result.entryCandidates.push(c);
    if (!dep('react-native-reanimated') || !dep('react-native-gesture-handler') || !dep('react-native-svg'))
      result.notes.push('Some required RN peers are missing (reanimated / gesture-handler / svg / async-storage / netinfo / get-random-values) — install them.');
    if (has('ios')) result.notes.push('ios/ exists → run `pod install` after installing native peers.');
  } else if (dep('react')) {
    result.platform = 'web';
    if (dep('next')) {
      result.framework = 'next';
      result.router = has('app') || has('src', 'app') ? 'next-app' : 'next-pages';
      result.pagesDir = result.router === 'next-app' ? (has('src', 'app') ? 'src/app' : 'app') : (has('src', 'pages') ? 'src/pages' : 'pages');
      result.envConvention = 'NEXT_PUBLIC_';
      result.envFile = '.env.local';
      result.notes.push('Next.js: the chat must render client-side only ("use client" + next/dynamic with ssr:false). Server routes can mint the client JWT.');
    } else if (dep('vite')) {
      result.framework = 'vite';
      result.envConvention = 'VITE_';
      result.envFile = '.env.local';
    } else if (dep('react-scripts')) {
      result.framework = 'cra';
      result.envConvention = 'REACT_APP_';
      result.envFile = '.env.local';
    } else if (dep('@remix-run/react') || dep('react-router') && has('react-router.config.ts')) {
      result.framework = 'remix';
      result.envConvention = 'VITE_';
      result.envFile = '.env';
      result.notes.push('Remix / React Router framework mode: render the chat only on the client (useEffect-gated or ClientOnly).');
    } else {
      result.framework = 'react-unknown';
      result.envConvention = 'VITE_';
      result.envFile = '.env.local';
      result.notes.push('React detected but bundler unknown — check how env vars are exposed to the browser.');
    }
    if (dep('react-router-dom') || dep('react-router')) result.router = result.router === 'none' ? 'react-router' : result.router;
    for (const c of ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx', 'src/App.tsx', 'src/App.jsx', 'app/layout.tsx', 'src/app/layout.tsx', 'pages/_app.tsx', 'src/pages/_app.tsx', 'app/root.tsx']) if (has(c)) result.entryCandidates.push(c);
    if (!result.pagesDir) {
      for (const c of ['src/pages', 'src/routes', 'src/views', 'src/screens', 'app/routes']) if (has(c)) { result.pagesDir = c; break; }
    }
  } else {
    result.platform = 'unknown';
    result.notes.push('No react / react-native dependency. If this is a backend-only repo, only the server-side token route applies here.');
  }

  const major = (v) => Number(String(v || '').replace(/[^0-9.]/g, '').split('.')[0]);
  if (result.platform === 'web' && result.react && major(result.react) < 18) result.notes.push(`React ${result.react} is below the ^18.3 peer requirement of @ethora/chat-component.`);
  if (result.platform === 'react-native' && result.reactNative && major(result.reactNative.replace(/^0\./, '')) < 73 && /^[~^]?0\./.test(result.reactNative)) result.notes.push(`react-native ${result.reactNative} is below the >=0.73 peer requirement.`);
}

// existing pages/screens listing (helps the "which page?" question)
if (result.pagesDir && has(result.pagesDir)) {
  try {
    const walk = (d, depth = 0) => {
      if (depth > 2) return [];
      return readdirSync(join(dir, d)).flatMap((f) => {
        const p = join(d, f);
        if (f === 'node_modules' || f.startsWith('.')) return [];
        if (statSync(join(dir, p)).isDirectory()) return walk(p, depth + 1);
        return /\.(t|j)sx?$/.test(f) ? [p] : [];
      });
    };
    result.existingPages = walk(result.pagesDir).slice(0, 60);
  } catch { /* ignore */ }
}

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Project: ${result.name || '(no package.json)'}  @ ${dir}`);
  console.log(`  platform:   ${result.platform}`);
  console.log(`  framework:  ${result.framework}`);
  console.log(`  router:     ${result.router}`);
  console.log(`  pm:         ${result.pm}   typescript: ${result.typescript}`);
  console.log(`  react:      ${result.react || '-'}   react-native: ${result.reactNative || '-'}   expo: ${result.expo || '-'}`);
  console.log(`  ethora:     web=${result.ethoraWeb || '-'}  rn=${result.ethoraRn || '-'}`);
  console.log(`  env:        ${result.envConvention || '-'} → ${result.envFile || '-'}`);
  console.log(`  entries:    ${result.entryCandidates.join(', ') || '-'}`);
  if (result.pagesDir) console.log(`  pages dir:  ${result.pagesDir}${result.existingPages?.length ? ' (' + result.existingPages.length + ' files)' : ''}`);
  for (const n of result.notes) console.log(`  note: ${n}`);
}
