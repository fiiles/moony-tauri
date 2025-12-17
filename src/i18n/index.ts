/**
 * i18n Configuration
 * 
 * Supports English (en) and Czech (cs) languages with namespace-based organization.
 * Language preference is stored in localStorage for pre-auth state and synced to user profile after login.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all translation namespaces
import enCommon from './locales/en/common.json';
import enDashboard from './locales/en/dashboard.json';
import enSettings from './locales/en/settings.json';
import enAuth from './locales/en/auth.json';
import enInvestments from './locales/en/investments.json';
import enSavings from './locales/en/savings.json';
import enLoans from './locales/en/loans.json';
import enCrypto from './locales/en/crypto.json';
import enBonds from './locales/en/bonds.json';
import enRealEstate from './locales/en/realEstate.json';
import enOtherAssets from './locales/en/otherAssets.json';
import enInsurance from './locales/en/insurance.json';

import csCommon from './locales/cs/common.json';
import csDashboard from './locales/cs/dashboard.json';
import csSettings from './locales/cs/settings.json';
import csAuth from './locales/cs/auth.json';
import csInvestments from './locales/cs/investments.json';
import csSavings from './locales/cs/savings.json';
import csLoans from './locales/cs/loans.json';
import csCrypto from './locales/cs/crypto.json';
import csBonds from './locales/cs/bonds.json';
import csRealEstate from './locales/cs/realEstate.json';
import csOtherAssets from './locales/cs/otherAssets.json';
import csInsurance from './locales/cs/insurance.json';

export const SUPPORTED_LANGUAGES = ['en', 'cs'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, { native: string; english: string }> = {
    en: { native: 'English', english: 'English (US)' },
    cs: { native: 'Čeština', english: 'Czech' },
};

// Namespace definitions for type safety
export const NAMESPACES = [
    'common',
    'dashboard',
    'settings',
    'auth',
    'investments',
    'savings',
    'loans',
    'crypto',
    'bonds',
    'realEstate',
    'otherAssets',
    'insurance',
] as const;

export type Namespace = typeof NAMESPACES[number];

const resources = {
    en: {
        common: enCommon,
        dashboard: enDashboard,
        settings: enSettings,
        auth: enAuth,
        investments: enInvestments,
        savings: enSavings,
        loans: enLoans,
        crypto: enCrypto,
        bonds: enBonds,
        realEstate: enRealEstate,
        otherAssets: enOtherAssets,
        insurance: enInsurance,
    },
    cs: {
        common: csCommon,
        dashboard: csDashboard,
        settings: csSettings,
        auth: csAuth,
        investments: csInvestments,
        savings: csSavings,
        loans: csLoans,
        crypto: csCrypto,
        bonds: csBonds,
        realEstate: csRealEstate,
        otherAssets: csOtherAssets,
        insurance: csInsurance,
    },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: NAMESPACES,

        // Language detection options
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'moony-language',
            caches: ['localStorage'],
        },

        interpolation: {
            escapeValue: false, // React already escapes values
        },

        react: {
            useSuspense: false, // Disable suspense for smoother UX
        },
    });

export default i18n;

/**
 * Get the locale string for Intl APIs based on language
 */
export function getLocaleForLanguage(lang: SupportedLanguage): string {
    const localeMap: Record<SupportedLanguage, string> = {
        en: 'en-US',
        cs: 'cs-CZ',
    };
    return localeMap[lang] || 'en-US';
}

/**
 * Format a date according to the current language
 */
export function formatDateForLanguage(date: Date | string, lang: SupportedLanguage, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const locale = getLocaleForLanguage(lang);
    return d.toLocaleDateString(locale, options);
}

/**
 * Format a number according to the current language
 */
export function formatNumberForLanguage(value: number, lang: SupportedLanguage, options?: Intl.NumberFormatOptions): string {
    const locale = getLocaleForLanguage(lang);
    return value.toLocaleString(locale, options);
}
