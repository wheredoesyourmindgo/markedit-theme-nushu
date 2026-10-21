import { overrideThemes } from 'markedit-theming';
import { lightColors, darkColors, lightPalette, darkPalette } from './colors';
import { nushuTheme } from './theme';
import { nushuSyntax } from './syntax';

const dark = { dark: true };

overrideThemes({
  light: { extension: [nushuTheme(lightPalette), nushuSyntax(lightPalette)], colors: lightColors },
  dark: { extension: [nushuTheme(darkPalette, dark), nushuSyntax(darkPalette, dark)], colors: darkColors },
  options: { settingsKey: 'extension.markeditThemeNushu' },
});
