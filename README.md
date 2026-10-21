# markedit-theme-nushu

[Nushu](https://github.com/wheredoesyourmindgo/nushu-vscode-theme) Light and Nushu Dark for [MarkEdit](https://github.com/MarkEdit-app/MarkEdit), built on [MarkEdit-theming](https://github.com/MarkEdit-app/MarkEdit-theming). Nushu is a warm, low-contrast theme built on GitHub's Primer colors, with paper and earth-tone backgrounds.

The theme follows MarkEdit's appearance, so it switches between Nushu Light and Nushu Dark with the system. Like every MarkEdit theme, it doesn't appear in MarkEdit's Settings. It overrides whichever theme is selected there. GitHub is the closest base, so keep that selected.

## Installation

Download `markedit-theme-nushu.js` from the [latest release](https://github.com/wheredoesyourmindgo/markedit-theme-nushu/releases/latest) and copy it to `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/`. Then restart MarkEdit.

To build it yourself, run `npm install && npm run build`. The build copies the script into MarkEdit's `scripts` folder; run `npm run reload` to restart MarkEdit.

## Settings

In MarkEdit's [settings.json](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization#advanced-settings), add an `extension.markeditThemeNushu` entry to choose where the theme applies. The default is:

```json
{
  "extension.markeditThemeNushu": {
    "enabledMode": "both"
  }
}
```

`enabledMode` can be `both`, `light`, `dark`, or `none` to turn the theme off.

## Development

The colors come from the Nushu VS Code themes, which are the source of truth. `colors.ts` is generated, so don't edit it directly. After changing the VS Code themes, regenerate it and rebuild:

```sh
npm run sync
npm run build
```

`npm run sync` reads `../nushu-vscode-theme/themes` by default. To use another folder, pass its path or set `NUSHU_THEMES_DIR`.

To build `dist/` without copying it into MarkEdit, for example in CI, set `CI=1`.

## Publishing to the MarkEdit Extension Registry

1. Bump `version` in `package.json`, run `CI=1 npm run build`, and commit `dist/`.
2. Create a GitHub release tagged `v<version>` and attach `dist/markedit-theme-nushu.js`.
3. Update `registry/markedit-theme-nushu.json` with the release's version, URL, and SHA-256 (`shasum -a 256 dist/markedit-theme-nushu.js`).
4. Copy that file to `themes/` in a fork of [MarkEdit-app/extensions](https://github.com/MarkEdit-app/extensions) and open a pull request.

## License

MIT
