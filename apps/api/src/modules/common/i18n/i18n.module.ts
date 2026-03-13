import { Global, Injectable, Module } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

type LocaleMessages = Record<string, unknown>;

const SUPPORTED_LOCALES = ['tr', 'en'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: SupportedLocale = 'tr';

@Injectable()
export class I18nService {
  private readonly messages = new Map<SupportedLocale, LocaleMessages>();

  constructor() {
    for (const locale of SUPPORTED_LOCALES) {
      const filePath = path.join(__dirname, 'locales', `${locale}.json`);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        this.messages.set(locale, JSON.parse(raw) as LocaleMessages);
      } catch {
        this.messages.set(locale, {});
      }
    }
  }

  /**
   * Detects the preferred locale from an Accept-Language header value.
   * Falls back to DEFAULT_LOCALE ('tr') if none match.
   */
  detectLocale(acceptLanguage?: string): SupportedLocale {
    if (!acceptLanguage) return DEFAULT_LOCALE;
    const tags = acceptLanguage
      .split(',')
      .map((part) => part.split(';')[0]?.trim().toLowerCase().slice(0, 2));
    for (const tag of tags) {
      if (tag && SUPPORTED_LOCALES.includes(tag as SupportedLocale)) {
        return tag as SupportedLocale;
      }
    }
    return DEFAULT_LOCALE;
  }

  /**
   * Translates a dot-notation key with optional interpolation params.
   * e.g. translate('errors.notFound', 'tr')
   *      translate('errors.quotaExceeded', 'en', { resource: 'session' })
   *
   * Falls back to the key itself if not found.
   */
  translate(
    key: string,
    locale: string = DEFAULT_LOCALE,
    params?: Record<string, string | number>,
  ): string {
    const resolvedLocale: SupportedLocale = SUPPORTED_LOCALES.includes(locale as SupportedLocale)
      ? (locale as SupportedLocale)
      : DEFAULT_LOCALE;

    const dict = this.messages.get(resolvedLocale) ?? {};
    const parts = key.split('.');
    let node: unknown = dict;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in (node as object)) {
        node = (node as Record<string, unknown>)[part];
      } else {
        node = undefined;
        break;
      }
    }

    let result = typeof node === 'string' ? node : key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replaceAll(`{{${k}}}`, String(v));
      }
    }

    return result;
  }
}

@Global()
@Module({
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {}
