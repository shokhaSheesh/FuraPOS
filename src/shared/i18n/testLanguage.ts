import { useLanguageStore } from './language'

/**
 * Tests read the English source, not a translation of it.
 *
 * Assertions like `expect(orderStatusLabel('sent')).toBe('Sent')` are about
 * the model, and rewriting them in Russian would make every one of them a test
 * of the dictionary instead. English is the key, so this simply turns the
 * lookup off.
 */
useLanguageStore.setState({ language: 'en' })
