import * as WebBrowser from 'expo-web-browser';
import { legalUrls, type LegalPage } from './urls';

/** Opens a legal page in the system browser sheet; never throws (a closed sheet is fine). */
export async function openLegal(page: LegalPage): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(legalUrls()[page]);
  } catch {
    // Best effort: no browser, or the sheet was closed at once.
  }
}
