-- Migration 002: Seed basic crops dictionary
-- Базовый справочник культур для MVP

INSERT INTO crops (name, category, sowing_start_day, sowing_end_day, transplant_days, harvest_days, watering_freq_days, frost_sensitive) VALUES
-- Овощи
('Томат',        'vegetable', 60,  90,  60,  110, 3,  true),
('Огурец',       'vegetable', 120, 150, 30,  60,  2,  true),
('Перец',        'vegetable', 45,  75,  75,  130, 3,  true),
('Кабачок',      'vegetable', 130, 155, NULL, 55,  3,  true),
('Баклажан',     'vegetable', 45,  75,  75,  140, 3,  true),
('Капуста белокочанная', 'vegetable', 75, 110, 45, 130, 4, false),
('Морковь',      'vegetable', 90,  130, NULL, 100, 5,  false),
('Свёкла',       'vegetable', 100, 140, NULL, 90,  5,  false),
('Лук репчатый', 'vegetable', 90,  130, NULL, 100, 4,  false),
('Чеснок',       'vegetable', 270, 310, NULL, 60,  5,  false),
('Редис',        'vegetable', 90,  260, NULL, 25,  2,  false),
('Салат листовой','vegetable', 90, 260, NULL, 35,  2,  false),
('Картофель',    'vegetable', 110, 145, NULL, 90,  5,  true),
-- Зелень
('Укроп',        'herb',      90,  240, NULL, 40,  3,  false),
('Петрушка',     'herb',      90,  240, NULL, 60,  3,  false),
('Базилик',      'herb',      130, 160, 45,  60,  2,  true),
('Кинза',        'herb',      100, 200, NULL, 35,  3,  false),
-- Ягоды
('Клубника',     'berry',     NULL, NULL, NULL, NULL, 4, false),
('Малина',       'berry',     NULL, NULL, NULL, NULL, 5, false),
-- Цветы
('Бархатцы',     'flower',    130, 160, 30,  75,  3,  true),
('Петуния',      'flower',    60,  90,  60,  120, 2,  true)
ON CONFLICT DO NOTHING;
