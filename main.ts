import { overrideThemes } from 'markedit-theming';
import { lightColors, darkColors } from './colors';

overrideThemes({
  light: { colors: lightColors },
  dark: { colors: darkColors },
  options: { settingsKey: 'extension.markeditThemeNushu' },
});
