-- 079_seed_crops_harvest_doy.sql
-- Базовое (для зоны 5, средняя полоса) окно съёма ягодных кустов и плодовых деревьев —
-- общеизвестные агротехнические сроки, не специфичные для отдельного сорта (сорт их сужает
-- и переопределяет через crop_varieties.harvest_doy_*, см. effectiveHarvestWindow).
-- День года: 1 июня=152, 1 июля=182, 1 августа=213, 1 сентября=244, 1 октября=274.

UPDATE crops SET harvest_doy_start = 161, harvest_doy_end = 191 WHERE name = 'Клубника'; -- 10 июня – 10 июля
UPDATE crops SET harvest_doy_start = 186, harvest_doy_end = 227 WHERE name = 'Малина'; -- 5 июля – 15 августа
UPDATE crops SET harvest_doy_start = 182, harvest_doy_end = 206 WHERE name = 'Смородина чёрная'; -- 1–25 июля
UPDATE crops SET harvest_doy_start = 191, harvest_doy_end = 222 WHERE name = 'Смородина красная'; -- 10 июля – 10 августа
UPDATE crops SET harvest_doy_start = 191, harvest_doy_end = 222 WHERE name = 'Смородина белая'; -- 10 июля – 10 августа
UPDATE crops SET harvest_doy_start = 182, harvest_doy_end = 213 WHERE name = 'Крыжовник'; -- 1 июля – 1 августа
UPDATE crops SET harvest_doy_start = 213, harvest_doy_end = 263 WHERE name = 'Ежевика'; -- 1 августа – 20 сентября
UPDATE crops SET harvest_doy_start = 152, harvest_doy_end = 171 WHERE name = 'Жимолость съедобная'; -- 1–20 июня, самая ранняя ягода
UPDATE crops SET harvest_doy_start = 213, harvest_doy_end = 288 WHERE name = 'Яблоня'; -- 1 августа – 15 октября (широко: летние/осенние/зимние сорта)
UPDATE crops SET harvest_doy_start = 213, harvest_doy_end = 273 WHERE name = 'Груша'; -- 1 августа – 30 сентября
UPDATE crops SET harvest_doy_start = 182, harvest_doy_end = 206 WHERE name = 'Вишня'; -- 1–25 июля
UPDATE crops SET harvest_doy_start = 161, harvest_doy_end = 191 WHERE name = 'Черешня'; -- 10 июня – 10 июля
UPDATE crops SET harvest_doy_start = 213, harvest_doy_end = 258 WHERE name = 'Слива'; -- 1 августа – 15 сентября
