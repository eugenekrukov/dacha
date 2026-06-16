-- Migration 039: фото болезней и вредителей кустарников и деревьев.
-- Источник: Wikimedia Commons (лицензии проверены — CC0/CC-BY/CC-BY-SA/PD).
-- Файлы загружены на сервер скриптом scripts/download_guide_images_shrub_tree.sh.
-- Идемпотентно: UPDATE по slug.

-- Дополнительные guide_entries для щитовки и зелёной тли (изображения найдены)
INSERT INTO guide_entries (slug, name, kind, category, danger, description, symptoms, conditions, treatment, prevention, season, search_text)
VALUES
  ('schitovka-yablonevaya', 'Щитовка яблонная', 'pest', 'насекомое', 2,
   'Запятовидная щитовка (Lepidosaphes ulmi) — самая распространённая щитовка на яблоне, груше, сливе и вишне. Питается соком из коры.',
   'Серые или буро-коричневые удлинённые щитки (длина 2–3 мм) на коре ветвей и стволе, хаотично покрывающие поверхность. Поражённые ветви усыхают; при массовом заселении кора растрескивается.',
   'Быстро распространяется на загущённых посадках. Зимуют яйца под щитком самки.',
   'Нитрафен ранней весной (до распускания почек); Актара, Командор в период выхода личинок (июнь); Препарат 30 Плюс — позднеосеннее опрыскивание.',
   'Прореживание кроны; побелка штамба и скелетных ветвей известью; очистка отмершей коры; привлечение птиц.',
   'июнь (личинки), круглый год (взрослые)',
   'щитовка яблонная запятовидная кора ветви серые бугорки яблоня груша слива вредитель насекомое'),

  ('zelenaya-tlya-yablonevaya', 'Тля зелёная яблонная', 'pest', 'насекомое', 2,
   'Aphis pomi — специфическая тля яблони и груши. Образует плотные колонии на молодых побегах весной.',
   'Молодые листья на кончиках побегов скручиваются и деформируются; колонии зелёной тли на нижней стороне; липкие выделения, на которых развивается сажистый гриб.',
   'Массовое размножение при тёплой сухой весне. Зимуют яйца у основания почек.',
   'Фитоверм, Актара, Биотлин при первых колониях. Раннее опрыскивание Нитрафеном (до распускания почек) — против зимующих яиц.',
   'Укроп и петрушка в цвету привлекают хищных мух-журчалок; не злоупотреблять азотными удобрениями; уничтожение муравейников.',
   'апрель — июнь',
   'тля зелёная яблонная колонии побеги скрученные листья яблоня груша липкий налёт вредитель насекомое')
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  kind        = EXCLUDED.kind,
  category    = EXCLUDED.category,
  danger      = EXCLUDED.danger,
  description = EXCLUDED.description,
  symptoms    = EXCLUDED.symptoms,
  conditions  = EXCLUDED.conditions,
  treatment   = EXCLUDED.treatment,
  prevention  = EXCLUDED.prevention,
  season      = EXCLUDED.season,
  search_text = EXCLUDED.search_text;

-- Дополнительные crop_guide_entries для щитовки и зелёной тли
INSERT INTO crop_guide_entries (crop_id, entry_id, signs)
SELECT c.id, e.id, v.signs
FROM (VALUES
  ('Яблоня', 'schitovka-yablonevaya',      'Серые удлинённые щитки на коре; поражённые ветви хуже плодоносят'),
  ('Яблоня', 'zelenaya-tlya-yablonevaya',  'Скрученные листья на кончиках всех молодых побегов весной, липкая роса'),
  ('Груша',  'schitovka-yablonevaya',      'Щитки на коре ветвей; усыхание побегов при сильном заселении'),
  ('Груша',  'zelenaya-tlya-yablonevaya',  'Колонии тли на молодых побегах; сажистый гриб на липких выделениях'),
  ('Слива',  'schitovka-yablonevaya',      'Скопления щитков на ветках, ослабление дерева'),
  ('Вишня',  'schitovka-yablonevaya',      'Буроватые щитки на стволе и скелетных ветвях')
) AS v(crop_name, slug, signs)
JOIN guide_entries e ON e.slug = v.slug
JOIN crops c ON c.id = (SELECT MIN(id) FROM crops WHERE name = v.crop_name)
ON CONFLICT (crop_id, entry_id) DO UPDATE SET signs = EXCLUDED.signs;

-- Фото guide_entries (источник: Wikimedia Commons)
UPDATE guide_entries SET
  image_url    = 'https://dacha.studio1008.com/app/media/guide/parsha-yabloni-grushi.jpg',
  image_credit = 'AfroBrazilian, CC BY-SA 3.0, Wikimedia Commons'
WHERE slug = 'parsha-yabloni-grushi';

UPDATE guide_entries SET
  image_url    = 'https://dacha.studio1008.com/app/media/guide/monilioz.jpg',
  image_credit = 'Shuhrataxmedov, CC BY-SA 3.0, Wikimedia Commons (Monilinia_disease_of_apple_01.jpg)'
WHERE slug = 'monilioz';

UPDATE guide_entries SET
  image_url    = 'https://dacha.studio1008.com/app/media/guide/kokkomikoze.jpg',
  image_credit = 'AfroBrazilian, CC BY-SA 3.0, Wikimedia Commons'
WHERE slug = 'kokkomikoze';

UPDATE guide_entries SET
  image_url    = 'https://dacha.studio1008.com/app/media/guide/klasterosporioz.jpg',
  image_credit = 'kühler Grill, Public Domain, Wikimedia Commons'
WHERE slug = 'klasterosporioz';

UPDATE guide_entries SET
  image_url    = 'https://dacha.studio1008.com/app/media/guide/yablonevaya-plodozhorka.jpg',
  image_credit = 'Richard001, Public Domain, Wikimedia Commons'
WHERE slug = 'yablonevaya-plodozhorka';

UPDATE guide_entries SET
  image_url    = 'https://dacha.studio1008.com/app/media/guide/yablonevyy-tsvetoyed.jpg',
  image_credit = 'Sanja565658, CC BY-SA 3.0, Wikimedia Commons'
WHERE slug = 'yablonevyy-tsvetoyed';

UPDATE guide_entries SET
  image_url    = 'https://dacha.studio1008.com/app/media/guide/vishnevaya-muha.jpg',
  image_credit = 'Holger Krisp, CC BY 4.0, Wikimedia Commons'
WHERE slug = 'vishnevaya-muha';

UPDATE guide_entries SET
  image_url    = 'https://dacha.studio1008.com/app/media/guide/schitovka-yablonevaya.jpg',
  image_credit = 'Richard Avery, CC BY-SA 4.0, Wikimedia Commons'
WHERE slug = 'schitovka-yablonevaya';

UPDATE guide_entries SET
  image_url    = 'https://dacha.studio1008.com/app/media/guide/zelenaya-tlya-yablonevaya.jpg',
  image_credit = 'InfluentialPoints, CC BY 3.0, Wikimedia Commons'
WHERE slug = 'zelenaya-tlya-yablonevaya';

UPDATE guide_entries SET
  image_url    = 'https://dacha.studio1008.com/app/media/guide/smorodinnaya-gallovaya-tlya.jpg',
  image_credit = 'Holger Krisp, CC BY 3.0, Wikimedia Commons'
WHERE slug = 'smorodinnaya-gallovaya-tlya';
