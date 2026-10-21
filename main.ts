import { overrideThemes } from 'markedit-theming';
import { lightColors, darkColors, lightPalette, darkPalette } from './colors';
import { nushuTheme } from './theme';

overrideThemes({
  light: { extension: nushuTheme(lightPalette), colors: lightColors },
  dark: { extension: nushuTheme(darkPalette, { dark: true }), colors: darkColors },
  options: { settingsKey: 'extension.markeditThemeNushu' },
});
