import { Directive, input, TemplateRef } from '@angular/core';

import { GpoTableCellContext } from '../core/gpo-table.types';

/** Шаблон ячейки: `<ng-template gpoTableCell="field">...</ng-template>` */
@Directive({
    selector: 'ng-template[gpoTableCell]',
    standalone: true,
})
export class GpoTableCellDirective {
    /** Поле колонки, к которой относится шаблон; приходит из атрибута gpoTableCell */
    readonly gpoTableCell = input.required<string>();

    constructor(public readonly templateRef: TemplateRef<GpoTableCellContext<Record<string, unknown>>>) {}
}
