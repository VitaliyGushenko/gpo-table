import { calculateGpoTableMaxHeight, MIN_GPO_TABLE_HEIGHT } from '../services/gpo-table-height.service';

describe('calculateGpoTableMaxHeight', () => {
    it('вычитает верх таблицы, блок под ней и отступ страницы', () => {
        expect(calculateGpoTableMaxHeight(900, 200, 100, 16)).toBe(584);
    });

    it('не учитывает прокрутку страницы выше нуля', () => {
        expect(calculateGpoTableMaxHeight(900, -120, 100)).toBe(800);
    });

    it('не сжимает таблицу меньше минимальной высоты', () => {
        expect(calculateGpoTableMaxHeight(300, 250, 100, 16)).toBe(MIN_GPO_TABLE_HEIGHT);
    });

    it('округляет дробную высоту вниз', () => {
        expect(calculateGpoTableMaxHeight(900.8, 200.4, 99.6, 0.3)).toBe(600);
    });
});
