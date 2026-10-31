import { calculateRegistryTableMaxHeight, MIN_REGISTRY_TABLE_HEIGHT } from './registry-table-height.service';

describe('calculateRegistryTableMaxHeight', () => {
    it('вычитает верх таблицы, блок под ней и отступ страницы', () => {
        expect(calculateRegistryTableMaxHeight(900, 200, 100, 16)).toBe(584);
    });

    it('не учитывает прокрутку страницы выше нуля', () => {
        expect(calculateRegistryTableMaxHeight(900, -120, 100)).toBe(800);
    });

    it('не сжимает таблицу меньше минимальной высоты', () => {
        expect(calculateRegistryTableMaxHeight(300, 250, 100, 16)).toBe(MIN_REGISTRY_TABLE_HEIGHT);
    });

    it('округляет дробную высоту вниз', () => {
        expect(calculateRegistryTableMaxHeight(900.8, 200.4, 99.6, 0.3)).toBe(600);
    });
});
