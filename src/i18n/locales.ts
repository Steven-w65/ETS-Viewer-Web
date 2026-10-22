import en from './resources/en.json';
import zhCN from './resources/zh-CN.json';
import appEn from './resources/app.en.json';
import appZh from './resources/app.zh-CN.json';
import readingEn from './resources/reading.en.json';
import readingZh from './resources/reading.zh-CN.json';
import importingEn from './resources/importing.en.json';
import importingZh from './resources/importing.zh-CN.json';

export interface SupportedLocale {
  code: string;
  nativeName: string;
  resources: Record<string, unknown>;
  aliases?: readonly string[];
  dir?: 'ltr' | 'rtl';
}
export const fallbackLocale = 'en';
export const supportedLocales: readonly SupportedLocale[] = [
  {
    code: 'en',
    nativeName: 'English',
    resources: { ...en, ...appEn, ...readingEn, ...importingEn },
  },
  {
    code: 'zh-CN',
    nativeName: '简体中文',
    resources: { ...zhCN, ...appZh, ...readingZh, ...importingZh },
  },
];
