import { DestroyRef, Directive, ElementRef, inject, NgZone, output } from '@angular/core';

import { GPO_TABLE_COLUMN_MIN_WIDTH, GPO_TABLE_RESIZE_CURSOR } from '../core/gpo-table.types';

/** Максимальная ширина колонки при перетаскивании */
const MAX_COLUMN_WIDTH = 3000;

/** Ширина из inline-стиля в px; у auto, процентов и rem её нет */
function getInlineWidthPx(th: HTMLElement): number | null {
    const match = /^(\d+(?:\.\d+)?)px$/.exec(th.style.width.trim());
    return match ? Number(match[1]) : null;
}

/** Ручка изменения ширины колонки в шапке таблицы */
@Directive({
    selector: '[gpoTableColumnResize]',
    standalone: true,
    host: {
        role: 'separator',
        'aria-orientation': 'vertical',
        '(pointerdown)': 'onPointerDown($event)',
        '(click)': '$event.stopPropagation()',
    },
})
export class GpoTableColumnResizeDirective {
    /** Новая ширина после перетаскивания */
    readonly widthChange = output<number>();

    /** Ширина во время перетаскивания; null — жест завершён или отменён */
    readonly widthPreviewChange = output<number | null>();

    private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly _destroyRef = inject(DestroyRef);
    private readonly _zone = inject(NgZone);

    private _th: HTMLElement | null = null;
    private _table: HTMLElement | null = null;
    private _startStyleWidth = '';
    private _dragWidth = 0;
    private _lastX = 0;
    private _lastWidth = 0;
    private _pendingX = 0;
    private _pendingMove = false;
    private _frame = 0;
    private _isDragging = false;
    private _previousCursor = '';
    private _previousUserSelect = '';

    constructor() {
        this._destroyRef.onDestroy(() => this._stopDrag());
    }

    onPointerDown(event: PointerEvent): void {
        if (event.button !== 0) {
            return;
        }

        const th = this._host.nativeElement.closest('th');
        if (!th) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this._th = th;
        this._table = th.closest('table');
        this._startStyleWidth = th.style.width;
        this._dragWidth = this._getModelWidth(th);
        this._lastX = event.clientX;
        this._lastWidth = 0;
        this._isDragging = true;

        const body = document.body;
        this._previousCursor = body.style.cursor;
        this._previousUserSelect = body.style.userSelect;
        body.style.cursor = GPO_TABLE_RESIZE_CURSOR;
        body.style.userSelect = 'none';

        // pointermove приходит на каждый кадр: вне Angular и без тика на каждое событие
        this._zone.runOutsideAngular(() => {
            document.addEventListener('pointermove', this._onPointerMove);
            document.addEventListener('pointerup', this._onPointerUp);
            document.addEventListener('pointercancel', this._onPointerCancel);
        });
    }

    private readonly _onPointerMove = (event: PointerEvent): void => {
        if (!this._isDragging) {
            return;
        }

        this._pendingX = event.clientX;
        this._pendingMove = true;
        this._scheduleFrame();
    };

    private readonly _onPointerUp = (): void => {
        if (!this._isDragging) {
            return;
        }

        this._cancelFrame();
        const flushedWidth = this._flushPending();
        const width = this._lastWidth;
        this._stopDrag();

        this._zone.run(() => {
            if (width) {
                if (flushedWidth) {
                    this.widthPreviewChange.emit(flushedWidth);
                }
                this.widthChange.emit(width);
            }
            this.widthPreviewChange.emit(null);
        });
    };

    private readonly _onPointerCancel = (): void => {
        if (!this._isDragging) {
            return;
        }

        this._cancelFrame();
        if (this._th) {
            this._th.style.width = this._startStyleWidth;
        }
        this._stopDrag();
        this._zone.run(() => this.widthPreviewChange.emit(null));
    };

    /** Схлопнуть несколько pointermove в один кадр */
    private _scheduleFrame(): void {
        if (this._frame) {
            return;
        }

        this._frame = requestAnimationFrame(() => {
            this._frame = 0;
            const width = this._flushPending();
            if (width) {
                this._zone.run(() => this.widthPreviewChange.emit(width));
            }
        });
    }

    private _cancelFrame(): void {
        if (!this._frame) {
            return;
        }

        cancelAnimationFrame(this._frame);
        this._frame = 0;
    }

    /** Применить последнюю позицию курсора; 0 — ширина не изменилась */
    private _flushPending(): number {
        if (!this._pendingMove) {
            return 0;
        }

        this._pendingMove = false;
        return this._applyMove(this._pendingX);
    }

    private _applyMove(clientX: number): number {
        const th = this._th;
        if (!this._isDragging || !th) {
            return 0;
        }

        const delta = clientX - this._lastX;
        this._lastX = clientX;
        this._dragWidth = this._clampWidth(this._dragWidth + delta * this._getDragScale(th));

        const width = Math.round(this._dragWidth);
        if (width === this._lastWidth) {
            return 0;
        }

        this._lastWidth = width;
        th.style.width = `${width}px`;
        return width;
    }

    private _clampWidth(width: number): number {
        return Math.min(MAX_COLUMN_WIDTH, Math.max(GPO_TABLE_COLUMN_MIN_WIDTH, width));
    }

    /** Ширина из модели (inline-стиль) или фактическая у авто-колонки */
    private _getModelWidth(th: HTMLElement): number {
        return getInlineWidthPx(th) ?? th.getBoundingClientRect().width;
    }

    /**
     * Если таблица растянута, браузер делит свободное место между колонками,
     * и фактическая ширина больше модели. Тянем модель медленнее, чтобы край
     * колонки шёл за курсором, а не прыгал.
     */
    private _getDragScale(th: HTMLElement): number {
        const rendered = th.getBoundingClientRect().width;
        const applied = getInlineWidthPx(th);
        const tableWidth = this._table?.getBoundingClientRect().width ?? 0;
        if (
            applied === null ||
            applied <= 0 ||
            rendered <= 0 ||
            tableWidth <= 0 ||
            Math.abs(rendered - applied) < 1
        ) {
            return 1;
        }

        // Фактическая ширина R = w * C / S, где w — ширина в модели,
        // C — ширина таблицы, S — сумма ширин всех колонок.
        const specifiedSum = (applied * tableWidth) / rendered;
        const otherSum = specifiedSum - applied;
        const gain = (tableWidth * otherSum) / (specifiedSum * specifiedSum);
        return gain > 0 ? 1 / gain : 1;
    }

    private _stopDrag(): void {
        this._cancelFrame();
        this._pendingMove = false;

        if (typeof document !== 'undefined') {
            document.removeEventListener('pointermove', this._onPointerMove);
            document.removeEventListener('pointerup', this._onPointerUp);
            document.removeEventListener('pointercancel', this._onPointerCancel);

            const body = document.body;
            body.style.cursor = this._previousCursor;
            body.style.userSelect = this._previousUserSelect;
        }

        this._isDragging = false;
        this._th = null;
        this._table = null;
        this._lastWidth = 0;
    }
}
