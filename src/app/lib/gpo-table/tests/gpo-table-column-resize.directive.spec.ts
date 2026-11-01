import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GpoTableColumnResizeDirective } from '../directives/gpo-table-column-resize.directive';

@Component({
    standalone: true,
    imports: [GpoTableColumnResizeDirective],
    template: `
        <table>
            <thead>
                <tr>
                    <th style="width: 120px">
                        <span
                            gpoTableColumnResize
                            (widthChange)="widths.push($event)"
                            (widthPreviewChange)="previews.push($event)"></span>
                    </th>
                </tr>
            </thead>
        </table>
    `,
})
class HostComponent {
    readonly widths: number[] = [];
    readonly previews: (number | null)[] = [];
}

function render(fixture: ComponentFixture<unknown>): void {
    fixture.detectChanges();
}

function pointer(type: string, clientX: number): PointerEvent {
    return new PointerEvent(type, { bubbles: true, clientX, button: 0 });
}

describe('GpoTableColumnResizeDirective', () => {
    it('меняет ширину колонки перетаскиванием', () => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        render(fixture);

        const th = fixture.nativeElement.querySelector('th') as HTMLElement;
        spyOn(th, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 120, 40));
        const handle = th.querySelector('[gpoTableColumnResize]') as HTMLElement;

        handle.dispatchEvent(pointer('pointerdown', 100));
        document.dispatchEvent(pointer('pointermove', 160));
        document.dispatchEvent(pointer('pointerup', 160));

        expect(fixture.componentInstance.widths).toEqual([180]);
        expect(th.style.width).toBe('180px');
    });

    it('отдаёт ширину на время перетаскивания и сбрасывает после отпускания', () => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        render(fixture);

        const th = fixture.nativeElement.querySelector('th') as HTMLElement;
        spyOn(th, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 120, 40));
        const handle = th.querySelector('[gpoTableColumnResize]') as HTMLElement;

        handle.dispatchEvent(pointer('pointerdown', 100));
        document.dispatchEvent(pointer('pointermove', 160));
        document.dispatchEvent(pointer('pointerup', 160));

        expect(fixture.componentInstance.previews).toEqual([180, null]);
    });

    it('не прыгает, если таблица растянула колонку шире её ширины', () => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        render(fixture);

        const th = fixture.nativeElement.querySelector('th') as HTMLElement;
        th.style.width = '60px';
        spyOn(th, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 120, 40));
        const table = th.closest('table') as HTMLElement;
        spyOn(table, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 300, 40));
        const handle = th.querySelector('[gpoTableColumnResize]') as HTMLElement;

        handle.dispatchEvent(pointer('pointerdown', 100));
        document.dispatchEvent(pointer('pointermove', 106));
        document.dispatchEvent(pointer('pointerup', 106));

        // Тянем от 60px в модели, а не от 120px фактической ширины
        expect(fixture.componentInstance.widths).toEqual([65]);
        expect(th.style.width).toBe('65px');
    });

    it('не сжимает колонку меньше минимальной ширины', () => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        render(fixture);

        const th = fixture.nativeElement.querySelector('th') as HTMLElement;
        spyOn(th, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 120, 40));
        const handle = th.querySelector('[gpoTableColumnResize]') as HTMLElement;

        handle.dispatchEvent(pointer('pointerdown', 100));
        document.dispatchEvent(pointer('pointermove', 0));
        document.dispatchEvent(pointer('pointerup', 0));

        expect(fixture.componentInstance.widths).toEqual([60]);
    });

});
