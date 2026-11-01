import { DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';

import { GPO_TABLE_COLUMN_MIN_WIDTH } from '../core/gpo-table.types';

/** Максимальная ширина колонки при перетаскивании */
const MAX_COLUMN_WIDTH = 3000;

/** Шаг изменения ширины с клавиатуры */
const KEYBOARD_STEP = 16;

/** Ручка изменения ширины колонки в шапке таблицы */
@Directive({
    selector: '[gpoTableColumnResize]',
    standalone: true,
    host: {
        role: 'separator',
        'aria-orientation': 'vertical',
        tabindex: '0',
        '(pointerdown)': 'onPointerDown($event)',
        '(click)': '$event.stopPropagation()',
        '(keydown)': 'onKeyDown($event)',
    },
})
export class GpoTableColumnResizeDirective {
    /** Новая ширина после перетаскивания или клавиатуры */
    readonly widthChange = output<number>();

    private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly _destroyRef = inject(DestroyRef);

    private _th: HTMLElement | null = null;
    private _startX = 0;
    private _startWidth = 0;
    private _lastWidth = 0;
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
        this._startX = event.clientX;
        this._startWidth = th.getBoundingClientRect().width;
        this._lastWidth = 0;
        this._isDragging = true;

        const body = document.body;
        this._previousCursor = body.style.cursor;
        this._previousUserSelect = body.style.userSelect;
        body.style.cursor = 'col-resize';
        body.style.userSelect = 'none';

        document.addEventListener('pointermove', this._onPointerMove);
        document.addEventListener('pointerup', this._onPointerUp);
        document.addEventListener('pointercancel', this._onPointerCancel);
    }

    onKeyDown(event: KeyboardEvent): void {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
            return;
        }

        const th = this._host.nativeElement.closest('th');
        if (!th) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const step = event.shiftKey ? KEYBOARD_STEP * 2.5 : KEYBOARD_STEP;
        const width = this._clampWidth(th.getBoundingClientRect().width + direction * step);

        th.style.width = `${width}px`;
        this.widthChange.emit(width);
    }

    private readonly _onPointerMove = (event: PointerEvent): void => {
        if (!this._isDragging) {
            return;
        }

        const width = this._clampWidth(this._startWidth + event.clientX - this._startX);
        this._lastWidth = width;
        if (this._th) {
            this._th.style.width = `${width}px`;
        }
    };

    private readonly _onPointerUp = (): void => {
        if (!this._isDragging) {
            return;
        }

        const width = this._lastWidth;
        this._stopDrag();
        if (width) {
            this.widthChange.emit(width);
        }
    };

    private readonly _onPointerCancel = (): void => {
        if (!this._isDragging) {
            return;
        }

        if (this._th) {
            this._th.style.width = this._startWidth ? `${this._startWidth}px` : '';
        }
        this._stopDrag();
    };

    private _clampWidth(width: number): number {
        return Math.min(MAX_COLUMN_WIDTH, Math.max(GPO_TABLE_COLUMN_MIN_WIDTH, Math.round(width)));
    }

    private _stopDrag(): void {
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
        this._lastWidth = 0;
    }
}
