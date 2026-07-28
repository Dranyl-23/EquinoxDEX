import type { SupportedLanguage, Translations } from '@/components/LanguageProvider';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'en',
  'ceb',
  'zh',
  'ko',
  'ja',
  'es',
  'fr',
  'de',
  'vi',
  'tr',
];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const loaders: Record<SupportedLanguage, () => Promise<{ default: Translations }>> = {
  en: () => import('./en'),
  ceb: () => import('./ceb'),
  zh: () => import('./zh'),
  ko: () => import('./ko'),
  ja: () => import('./ja'),
  es: () => import('./es'),
  fr: () => import('./fr'),
  de: () => import('./de'),
  vi: () => import('./vi'),
  tr: () => import('./tr'),
};

export async function loadTranslations(language: SupportedLanguage): Promise<Translations> {
  const loader = loaders[language] || loaders.en;
  const loaded = await loader();
  return loaded.default;
}

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}
