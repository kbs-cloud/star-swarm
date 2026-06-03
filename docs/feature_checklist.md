# Star-Swarm APK Packaging Feature Checklist

- `[x]` Install JDK 17 and configure Android SDK CLI tools
- `[x]` Install `@capacitor/core` and `@capacitor/cli`
- `[x]` Initialize Capacitor in the project (`capacitor.config.ts`)
- `[x]` Install `@capacitor/android` and add android native directory
- `[x]` Modify frontend environment detection (`env.ts` / `isPackagedMode`)
- `[x]` Apply `isPackagedMode` to `apiFetch.ts`, `MenuScreen.tsx`, `SettingsScreen.tsx`, `AuthBar.tsx`, and `LobbyScreen.tsx`
- `[x]` Add build scripts to `package.json`
- `[x]` Run build pipeline and compile `out/starswarm.apk`
- `[x]` Verify APK output and log details in `walkthrough.md`
