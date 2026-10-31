import { Injectable } from '@angular/core';

import { REGISTRY_COLUMN_MIN_WIDTH, RegistryColumnWidths } from './registry-table.types';

/** Префикс ключей localStorage для ширин колонок */
const STORAGE_PREFIX = 'registry-table-columns:';

/** Сохранение ширин колонок между сессиями */
@Injectable()
export class RegistryTableColumnWidthService {
    /** Прочитать сохранённые ширины; битые и слишком маленькие значения отбрасываются */
    load(storageKey: string | undefined): RegistryColumnWidths {
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
                if (typeof value === 'number' && Number.isFinite(value) && value >= REGISTRY_COLUMN_MIN_WIDTH) {
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
    save(storageKey: string | undefined, widths: RegistryColumnWidths): void {
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
