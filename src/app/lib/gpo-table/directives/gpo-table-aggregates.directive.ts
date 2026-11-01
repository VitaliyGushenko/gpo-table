import { Directive, TemplateRef } from '@angular/core';

import { GpoTableFooterContext } from '../core/gpo-table.types';

/** Шаблон агрегатов: `<ng-template gpoTableAggregates>...</ng-template>` */
@Directive({
    selector: 'ng-template[gpoTableAggregates]',
    standalone: true,
})
export class GpoTableAggregatesDirective {
    constructor(
        public readonly templateRef: TemplateRef<GpoTableFooterContext<Record<string, unknown>>>,
    ) {}
}
