/**
 * Public API стека расширенного поиска REST-таблиц (advanced-search-rest):
 * компоненты, дескрипторы полей, каркас страницы, утилиты перевода в Gridify.
 *
 * Страницы и модули импортируют стек одной строкой:
 *   import { AdvancedSearchPageBase, SearchItems } from 'src/app/components/advanced-search-rest';
 */
export * from './search-item';
export * from './search-form';
export * from './search-rules';
export * from './search-display-names';
export * from './word-search-modes';
export * from './advanced-search-button.component';
export * from './rest-advanced-search.component';
export * from './search-page.base';
