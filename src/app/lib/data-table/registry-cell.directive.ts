import { Directive, input, TemplateRef } from '@angular/core';

import { RegistryCellContext } from './registry-table.types';

/** Шаблон ячейки: `<ng-template appRegistryCell="field">...</ng-template>` */
@Directive({
    selector: 'ng-template[appRegistryCell]',
    standalone: true,
})
export class RegistryCellDirective {
    /** Поле колонки, к которой относится шаблон; приходит из атрибута appRegistryCell */
    readonly appRegistryCell = input.required<string>();

    constructor(public readonly templateRef: TemplateRef<RegistryCellContext<Record<string, unknown>>>) {}
}
