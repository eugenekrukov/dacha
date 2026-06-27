-- 053_crop_family.sql
-- Ботаническое семейство культуры — нужно для подсказки севооборота (сравнение по грядке за 3 года).

ALTER TABLE crops ADD COLUMN IF NOT EXISTS family TEXT;

UPDATE crops SET family = 'Паслёновые' WHERE id IN (1, 3, 5, 13, 21, 190);   -- Томат, Перец, Баклажан, Картофель, Петуния, Перец острый
UPDATE crops SET family = 'Тыквенные' WHERE id IN (2, 4, 169, 170, 188, 189); -- Огурец, Кабачок, Тыква, Патиссон, Арбуз, Дыня
UPDATE crops SET family = 'Крестоцветные' WHERE id IN (6, 11, 171, 172, 173, 174, 175, 191); -- Капуста б/к, Редис, Цветная/Брокколи/Пекинская, Редька, Репа, Хрен
UPDATE crops SET family = 'Зонтичные' WHERE id IN (7, 14, 15, 17, 183, 193); -- Морковь, Укроп, Петрушка, Кинза, Сельдерей, Пастернак
UPDATE crops SET family = 'Маревые' WHERE id IN (8, 178);                    -- Свёкла, Шпинат
UPDATE crops SET family = 'Луковые' WHERE id IN (9, 10, 176, 177);           -- Лук репчатый, Чеснок, Лук-порей, Лук-батун
UPDATE crops SET family = 'Астровые' WHERE id IN (12, 20);                   -- Салат листовой, Бархатцы
UPDATE crops SET family = 'Яснотковые' WHERE id IN (16, 184, 185);          -- Базилик, Мята, Тимьян
UPDATE crops SET family = 'Розоцветные' WHERE id IN (18, 19, 518, 520, 521, 522, 523, 524); -- Клубника, Малина, Ежевика, Яблоня, Груша, Вишня, Черешня, Слива
UPDATE crops SET family = 'Гречишные' WHERE id IN (179, 192);               -- Щавель, Ревень
UPDATE crops SET family = 'Бобовые' WHERE id IN (180, 181);                 -- Горох, Фасоль стручковая
UPDATE crops SET family = 'Злаковые' WHERE id IN (182);                     -- Кукуруза
UPDATE crops SET family = 'Крыжовниковые' WHERE id IN (186, 187, 516, 517); -- Смородина чёрная/красная/белая, Крыжовник
UPDATE crops SET family = 'Жимолостные' WHERE id IN (519);                  -- Жимолость съедобная
