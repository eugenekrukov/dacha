-- Migration 082: фото для новых записей справочника из миграции 081.
-- Источник — Wikimedia Commons (лицензии проверены: CC0/CC BY/CC BY-SA/PD), ширина 900–960 px.
-- Файлы лежат в репозитории (web/public/media/guide/<slug>.jpg) и выезжают со сборкой веба —
-- см. reference-dacha-web-static: если файла нет, SPA отдаёт index.html с кодом 200,
-- и картинка «молча» не показывается.
-- Каждый кадр просмотрен глазами и сверен с текстом симптомов записи.
-- Идемпотентно: UPDATE по slug.
--
-- ⚠️ Четыре записи из 081 СОЗНАТЕЛЬНО остались без фото — на Commons нет корректного кадра,
-- а неверная картинка в справочнике болезней хуже её отсутствия (ведёт к ложному диагнозу):
--   chernyy-rak                — есть только гравюра 1893 года, фотографий поражённой коры нет;
--   stolbur-fitoplazmoz        — кадров с деревянистыми плодами и уродливыми цветками нет;
--   mahrovost-smorodiny        — есть только сам почковый клещ (Cecidophyopsis ribis),
--                                махровых цветков смородины нет;
--   malinnaya-steblevaya-muha  — ни мухи Pegomya rubivora, ни поникших побегов малины.

UPDATE guide_entries SET image_url = v.url, image_credit = v.credit
FROM (VALUES
  ('medvedka',
   'https://dacha.studio1008.com/app/media/guide/medvedka.jpg',
   'H. Zell, CC BY-SA 3.0, Wikimedia Commons (Gryllotalpa_gryllotalpa_01.JPG)'),

  ('tripsy',
   'https://dacha.studio1008.com/app/media/guide/tripsy.jpg',
   'Schlaghecken Josef, CC BY-SA 4.0, Wikimedia Commons (Basilikum_Thripsbefall-Schlaghecken.jpg)'),

  ('sovki',
   'https://dacha.studio1008.com/app/media/guide/sovki.jpg',
   'Gyorgy Csoka, Hungary Forest Research Institute, Bugwood.org, CC BY 3.0 US, Wikimedia Commons (Helicoverpa_armigera_larva.jpg)'),

  ('kapustnaya-mol',
   'https://dacha.studio1008.com/app/media/guide/kapustnaya-mol.jpg',
   'Forest and Kim Starr, CC BY 3.0 US, Wikimedia Commons (Starr-150328-0638 Diamond Back Moth feeding damage)'),

  ('gallovaya-nematoda',
   'https://dacha.studio1008.com/app/media/guide/gallovaya-nematoda.jpg',
   'Scot Nelson, CC0, Wikimedia Commons (Meloidogyne_sp._on_Cucumis_sativus.jpg)'),

  ('mayskiy-hrusch',
   'https://dacha.studio1008.com/app/media/guide/mayskiy-hrusch.jpg',
   'Сарапулов, CC BY 4.0, Wikimedia Commons (Борозняк — лярва хруща травневого 01.jpg)'),

  ('lukovaya-zhurchalka',
   'https://dacha.studio1008.com/app/media/guide/lukovaya-zhurchalka.jpg',
   'Caroline Harding, MAF, CC BY 3.0 AU, Wikimedia Commons (Eumerus_strigatus_larva.jpg)'),

  ('rostkovaya-muha',
   'https://dacha.studio1008.com/app/media/guide/rostkovaya-muha.jpg',
   'Howard F. Schwartz, Colorado State University, Bugwood.org, CC BY 3.0 US, Wikimedia Commons (seedcorn maggot Delia platura)'),

  ('listovertka',
   'https://dacha.studio1008.com/app/media/guide/listovertka.jpg',
   'Gyorgy Csoka, Hungary Forest Research Institute, Bugwood.org, CC BY 3.0 US, Wikimedia Commons (Archips_rosana_larva.jpg)'),

  ('grushevaya-medyanitsa',
   'https://dacha.studio1008.com/app/media/guide/grushevaya-medyanitsa.jpg',
   'Mick E. Talbot, CC BY 2.0, Wikimedia Commons (Psylla_pyri.jpg)'),

  ('slivovaya-plodozhorka',
   'https://dacha.studio1008.com/app/media/guide/slivovaya-plodozhorka.jpg',
   'Fvlamoen, CC BY-SA 3.0, Wikimedia Commons (Grapholita_funebrana_FvL.jpg)'),

  ('krestotsvetnyy-klop',
   'https://dacha.studio1008.com/app/media/guide/krestotsvetnyy-klop.jpg',
   'Hectonichus, CC BY-SA 3.0, Wikimedia Commons (Pentatomidae — Eurydema oleracea-001.JPG)'),

  ('pennitsa-slyunyavaya',
   'https://dacha.studio1008.com/app/media/guide/pennitsa-slyunyavaya.jpg',
   'James K. Lindsey, CC BY-SA 3.0, Wikimedia Commons (Philaenus.spumarius.nymph.spittle.jpg)'),

  ('alternarioz-suhaya-pyatnistost',
   'https://dacha.studio1008.com/app/media/guide/alternarioz-suhaya-pyatnistost.jpg',
   'Michal Maňas, CC BY 4.0, Wikimedia Commons (Alternaria_solani_on_Solanum_lycopersicum.jpg)'),

  ('bakterialnyy-ozhog',
   'https://dacha.studio1008.com/app/media/guide/bakterialnyy-ozhog.jpg',
   'Scot Nelson, CC0, Wikimedia Commons (Fire blight of apple caused by Erwinia amylovora)'),

  ('rizoktonioz',
   'https://dacha.studio1008.com/app/media/guide/rizoktonioz.jpg',
   'Jerzy Opioła, CC BY-SA 4.0, Wikimedia Commons (Black scurf of potato)'),

  ('mokraya-bakterialnaya-gnil',
   'https://dacha.studio1008.com/app/media/guide/mokraya-bakterialnaya-gnil.jpg',
   'Schlaghecken Josef, CC BY 4.0, Wikimedia Commons (Sellerie Knollen Weichfäule)'),

  ('sosudistyy-bakterioz',
   'https://dacha.studio1008.com/app/media/guide/sosudistyy-bakterioz.jpg',
   'Scot Nelson, CC0, Wikimedia Commons (Black rot of cabbage)'),

  ('mozaika-virusnaya',
   'https://dacha.studio1008.com/app/media/guide/mozaika-virusnaya.jpg',
   'Downtowngal, CC BY-SA 4.0, Wikimedia Commons (Zucchini_yellow_mosaic_virus_leaf.jpg)'),

  ('chernaya-bakterialnaya-pyatnistost',
   'https://dacha.studio1008.com/app/media/guide/chernaya-bakterialnaya-pyatnistost.jpg',
   'Scot Nelson, CC0, Wikimedia Commons (Bacterial leaf spot of pepper)'),

  ('buraya-pyatnistost-zemlyaniki',
   'https://dacha.studio1008.com/app/media/guide/buraya-pyatnistost-zemlyaniki.jpg',
   'Rasbak, CC BY-SA 3.0, Wikimedia Commons (Rode-vlekkenziekte — Diplocarpon earlianum)'),

  ('sazhistyy-gribok',
   'https://dacha.studio1008.com/app/media/guide/sazhistyy-gribok.jpg',
   'Wee Hong, CC BY-SA 4.0, Wikimedia Commons (Sooty mould on leaves of Morus nigra)')
) AS v(slug, url, credit)
WHERE guide_entries.slug = v.slug;
