import type { TFunction } from "i18next";

/**
 * Translates API error messages that contain i18n keys.
 * 
 * The backend returns validation errors using translation keys like:
 * - "validation.principalPositive"
 * - "validation.loanNameRequired"
 * 
 * These may be returned as just the key, or wrapped in a message like:
 * - "Validation error: validation.principalPositive"
 * 
 * This function detects these patterns and translates them using
 * the common namespace's validation section.
 * 
 * @param error - The error object or error message string
 * @param t - The i18next translation function (should be from common namespace or support namespaced keys)
 * @returns The translated error message, or original message if no translation found
 */
export function translateApiError(error: Error | string, t: TFunction): string {
    const message = typeof error === "string" ? error : error.message;

    // Check if the message contains a translation key pattern (e.g., validation.xxx)
    // This handles both exact matches and messages like "Validation error: validation.xxx"
    const keyMatch = message.match(/(validation\.[a-zA-Z]+)/);
    if (keyMatch) {
        const key = keyMatch[1];
        const translated = t(key, { defaultValue: "" });
        // If translation was found (not empty), return it
        if (translated && translated !== key) {
            return translated;
        }
    }

    // Return original message if no translation key found
    return message;
}

