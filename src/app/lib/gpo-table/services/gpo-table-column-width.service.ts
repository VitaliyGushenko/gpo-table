import { Injectable } from '@angular/core';

import { GPO_TABLE_COLUMN_MIN_WIDTH, GpoTableColumnWidths } from '../core/gpo-table.types';

/** Префикс ключей localStorage для ширин колонок */
const STORAGE_PREFIX = 'gpo-table-columns:';

/** Сохранение ширин колонок между сессиями */
@Injectable()
export class GpoTableColumnWidthService {
    /** Прочитать сохранённые ширины; битые и слишком маленькие значения отбрасываются */
    load(storageKey: string | undefined): GpoTableColumnWidths {
        if (!storageKey || typeof localStorage === 'undefined') {
            return {};
        }

        try {
            const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
            if (!raw) {
                return {};
            }

            const parsed: unknown = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return {};
            }

            const widths: Record<string, number> = {};
            for (const [field, value] of Object.entries(parsed as Record<string, unknown>)) {
                if (typeof value === 'number' && Number.isFinite(value) && value >= GPO_TABLE_COLUMN_MIN_WIDTH) {
                    widths[field] = Math.round(value);
                }
            }
            return widths;
        } catch {
            // Приватный режим, запрет storage или битый JSON — просто без сохранённых ширин
            return {};
        }
    }

    /** Сохранить ширины; ошибки storage не ломают таблицу */
    save(storageKey: string | undefined, widths: GpoTableColumnWidths): void {
        if (!storageKey || typeof localStorage === 'undefined') {
            return;
        }

        try {
            localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(widths));
        } catch {
            // Переполнение или запрет storage: resize продолжает работать в памяти
        }
    }

    /** Удалить сохранённые ширины */
    clear(storageKey: string | undefined): void {
        if (!storageKey || typeof localStorage === 'undefined') {
            return;
        }

        try {
            localStorage.removeItem(STORAGE_PREFIX + storageKey);
        } catch {
            // storage недоступен — удалять нечего
        }
    }
}
