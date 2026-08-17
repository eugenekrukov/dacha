-- 075_crop_varieties_pilot.sql
-- Пилот на 3 культурах (томат/огурец/картофель), 3 сорта на культуру — проверяет схему и
-- бэкенд-плюмбинг (073/074) на реальных данных до конвейера на ~500 сортов (см. план).
-- Дни до урожая — среднее по диапазону, сверенному минимум по двум независимым каталогам
-- 2026-08-17 (tomatland.ru, sortoved.ru, agrognom.ru и др. — см. source построчно).

INSERT INTO crop_varieties (crop_id, name, ripening, harvest_days, is_hybrid, conditions, source) VALUES
((SELECT id FROM crops WHERE name = 'Томат'), 'Санька',        'early', 80,  false, 'any', 'каталоги сортов, сверено 2+ источника (tomatland.ru, botanichka.ru), 2026-08-17: 75-85 дней от всходов'),
((SELECT id FROM crops WHERE name = 'Томат'), 'Дубрава',       'early', 95,  false, 'any', 'каталоги сортов, сверено 2+ источника (tomatland.ru, sortoved.ru), 2026-08-17: 85-105 дней от всходов'),
((SELECT id FROM crops WHERE name = 'Томат'), 'Бычье сердце',  'late',  120, false, 'any', 'каталоги сортов, сверено 2+ источника (tomatland.ru, lenta.ru), 2026-08-17: 110-130 дней от всходов'),

((SELECT id FROM crops WHERE name = 'Огурец'), 'Конкурент',    'early', 45, false, 'any', 'каталоги сортов, сверено 2+ источника (ferma.expert, sortoved.ru), 2026-08-17: 40-50 дней от всходов'),
((SELECT id FROM crops WHERE name = 'Огурец'), 'Зозуля F1',    'early', 47, true,  'any', 'каталоги сортов, сверено 2+ источника (sortoved.ru, osemenah.ru), 2026-08-17: 40-56 дней от всходов'),
((SELECT id FROM crops WHERE name = 'Огурец'), 'Нежинский',    'mid',   50, false, 'any', 'каталоги сортов, сверено 2+ источника (ferma.expert, gryadki.com), 2026-08-17: 46-65 дней от всходов'),

((SELECT id FROM crops WHERE name = 'Картофель'), 'Ред Скарлетт', 'early', 75, false, 'any', 'каталоги сортов, сверено 2+ источника (ferma.expert, ogorodko.ru), 2026-08-17: 70-80 дней от всходов'),
((SELECT id FROM crops WHERE name = 'Картофель'), 'Невский',      'mid',   82, false, 'any', 'каталоги сортов, сверено 2+ источника (antonovsad.ru, gryadki.com), 2026-08-17: 75-90 дней от всходов'),
((SELECT id FROM crops WHERE name = 'Картофель'), 'Синеглазка',   'mid',   92, false, 'any', 'каталоги сортов, сверено 2+ источника (ferma.expert, ogorodko.ru), 2026-08-17: 85-100 дней от всходов')
ON CONFLICT (crop_id, name) DO NOTHING;
