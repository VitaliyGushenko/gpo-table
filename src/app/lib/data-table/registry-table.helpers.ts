import { formatDate, formatNumber } from '@angular/common';

import { RegistryColumn, RegistryValue } from './registry-table.types';

/** Прочитать поле строки по имени; вложенные объекты показывает только шаблон */
export function readRegistryValue<TRow extends object>(row: TRow, field: string): RegistryValue {
    const value = Reflect.get(row, field) as unknown;

    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (value instanceof Date) {
        return value;
    }

    // Объекты и массивы таблица не форматирует: для них нужна шаблонная колонка
    return undefined;
}

/** Текст ячейки без шаблона: число и дата форматируются, пустое значение — прочерк */
export function formatRegistryValue(value: RegistryValue, column: RegistryColumn, locale: string): string {
    const type = column.type ?? 'text';

    if (type === 'date') {
        const date = toDate(value);
        if (!date) {
            return value === null || value === undefined || value === '' ? '—' : String(value);
        }
        return formatDate(date, column.dateFormat ?? 'dd.MM.yyyy', locale);
    }

    if (type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return '—';
        }

        const digits =
            typeof column.numberDigits === 'number' && Number.isFinite(column.numberDigits)
                ? Math.max(0, Math.floor(column.numberDigits))
                : undefined;
        // Заданное число знаков показываем точно, по умолчанию — до двух без лишних нулей
        const format = digits === undefined ? '1.0-2' : `1.${digits}-${digits}`;
        return formatNumber(value, locale, format);
    }

    return value === null || value === undefined ? '' : String(value);
}

/** Текст ошибки для пользователя: строка, HttpErrorResponse или Error */
export function getErrorMessage(error: unknown, fallback = 'Произошла ошибка'): string {
    if (typeof error === 'string' && error) {
        return error;
    }

    if (error && typeof error === 'object') {
        const response = error as { error?: unknown; message?: unknown };

        // Сначала тело ответа: там человекочитаемый текст бэкенда
        if (typeof response.error === 'string' && response.error) {
            return response.error;
        }
        if (response.error && typeof response.error === 'object') {
            const body = response.error as Record<string, unknown>;
            const text = body['Message'] ?? body['message'];
            if (typeof text === 'string' && text) {
                return text;
            }
        }

        // Потом message: для обычного Error или сетевой ошибки
        if (typeof response.message === 'string' && response.message) {
            return response.message;
        }
    }

    return fallback;
}

/** AND-склейка Gridify-фильтров: `(base),(search)` — скобки сохраняют OR-группы */
export function combineGridifyFilters(...filters: Array<string | undefined | null>): string | undefined {
    const parts = filters.map((filter) => filter?.trim()).filter((filter): filter is string => !!filter);

    return parts.length ? parts.map((filter) => `(${filter})`).join(',') : undefined;
}

/** Дата из значения ячейки; некорректное значение — null */
function toDate(value: RegistryValue): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}
