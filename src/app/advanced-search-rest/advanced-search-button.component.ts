import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
    selector: 'app-advanced-search-button',
    standalone: true,
    imports: [NzButtonModule, NzIconModule],
    template: `
        <button id="ext-search-button" title="Расширенный поиск" nz-button nzType="primary" (click)="openSearch.emit()">
            <i nz-icon nzType="filter" [class.pulse]="pulse"></i>
            <span>Расширенный поиск</span>
        </button>
    `,
    styles: [`
        #ext-search-button {
            i {
                position: relative;

                &.pulse::before {
                    z-index: 1;
                    position: absolute;
                    content: '';
                    height: 14px;
                    width: 14px;
                    left: 0;
                    border-radius: 50%;
                    top: 0;
                    background-color: transparent;
                    box-shadow: 0 0 5px 5px rgb(255 255 255);
                }

                &.pulse::after {
                    z-index: 1;
                    position: absolute;
                    content: '';
                    height: 14px;
                    width: 14px;
                    left: 0;
                    border-radius: 50%;
                    top: 0;
                    background-color: transparent;
                    box-shadow: 0 0 5px 5px rgb(255 255 255);
                }

                &.pulse::before {
                    animation: pulseLarge 1.5s infinite ease-out;
                }

                &.pulse::after {
                    animation: euiBeaconPulseSmall 1.5s infinite ease-out 0.25s;
                }

                &.pulse:hover {
                    animation: none;
                }
            }
        }

        @keyframes euiBeaconPulseLarge {
            0% {
                transform: scale(0.1);
                opacity: 1;
            }

            70% {
                transform: scale(3);
                opacity: 0;
            }

            100% {
                opacity: 0;
            }
        }

        @keyframes euiBeaconPulseSmall {
            0% {
                transform: scale(0.1);
                opacity: 1;
            }

            70% {
                transform: scale(2);
                opacity: 0;
            }

            100% {
                opacity: 0;
            }
        }    
    `],
})
export class AdvancedSearchButtonComponent {
    /**
     * Фильтр таблицы: пульсация, пока есть хотя бы один ключ
     */
    @Input() filter?: object | null;

    /**
     * Клик по кнопке — страница открывает drawer расширенного поиска
     */
    @Output() openSearch = new EventEmitter<void>();

    /**
     * Активен хотя бы один фильтр — пульсировать иконкой
     */
    get pulse(): boolean {
        return Object.keys(this.filter ?? {}).length > 0;
    }
}
