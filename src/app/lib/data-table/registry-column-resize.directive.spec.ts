import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistryColumnResizeDirective } from './registry-column-resize.directive';

@Component({
    standalone: true,
    imports: [RegistryColumnResizeDirective],
    template: `
        <table>
            <thead>
                <tr>
                    <th style="width: 120px">
                        <span appRegistryColumnResize (widthChange)="widths.push($event)"></span>
                    </th>
                </tr>
            </thead>
        </table>
    `,
})
class HostComponent {
    readonly widths: number[] = [];
}

function render(fixture: ComponentFixture<unknown>): void {
    fixture.detectChanges();
}

function pointer(type: string, clientX: number): PointerEvent {
    return new PointerEvent(type, { bubbles: true, clientX, button: 0 });
}

describe('RegistryColumnResizeDirective', () => {
    it('меняет ширину колонки перетаскиванием', () => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        render(fixture);

        const th = fixture.nativeElement.querySelector('th') as HTMLElement;
        spyOn(th, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 120, 40));
        const handle = th.querySelector('[appRegistryColumnResize]') as HTMLElement;

        handle.dispatchEvent(pointer('pointerdown', 100));
        document.dispatchEvent(pointer('pointermove', 160));
        document.dispatchEvent(pointer('pointerup', 160));

        expect(fixture.componentInstance.widths).toEqual([180]);
        expect(th.style.width).toBe('180px');
    });

    it('не сжимает колонку меньше минимальной ширины', () => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        render(fixture);

        const th = fixture.nativeElement.querySelector('th') as HTMLElement;
        spyOn(th, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 120, 40));
        const handle = th.querySelector('[appRegistryColumnResize]') as HTMLElement;

        handle.dispatchEvent(pointer('pointerdown', 100));
        document.dispatchEvent(pointer('pointermove', 0));
        document.dispatchEvent(pointer('pointerup', 0));

        expect(fixture.componentInstance.widths).toEqual([60]);
    });

    it('меняет ширину с клавиатуры', () => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        render(fixture);

        const th = fixture.nativeElement.querySelector('th') as HTMLElement;
        spyOn(th, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 120, 40));
        const handle = th.querySelector('[appRegistryColumnResize]') as HTMLElement;

        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

        expect(fixture.componentInstance.widths).toEqual([136]);
    });
});
