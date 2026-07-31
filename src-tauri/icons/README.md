# Icons

Generate app icons from `public/icons/icon-512.png` (or the SVG source `public/logos/kheru-icon-rounded.svg`) with the Tauri CLI:

```bash
pnpm tauri icon public/icons/icon-512.png
```

That command populates this directory with the platform-specific formats referenced from `tauri.conf.json` (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`).
