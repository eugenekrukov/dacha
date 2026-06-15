-- 035_seed_guide_images_2.sql
-- Вторая волна фото справочника: добиваем «длинный хвост» из контент-долга.
-- Источники: Wikimedia Commons (CC0/CC-BY/CC-BY-SA, лицензия проверена построчно,
-- каждый кадр просмотрен глазами; вотермарки Bugwood/лабораторные микрофото отбракованы).
-- Идемпотентно: UPDATE по slug, повторный прогон переустанавливает те же значения.

UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/tserkosporoz.jpg', image_credit='Plant pests and diseases, CC0, Wikimedia Commons' WHERE slug='tserkosporoz';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/parsha-obyknovennaya.jpg', image_credit='Rasbak, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='parsha-obyknovennaya';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/dolgonosik-zemlyanichnyy.jpg', image_credit='Ryan Hodnett, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='dolgonosik-zemlyanichnyy';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/malinno-zemlyanichnyy-dolgonosik.jpg', image_credit='Ryan Hodnett, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='malinno-zemlyanichnyy-dolgonosik';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/gorohovaya-plodozhorka.jpg', image_credit='Bj.schoenmakers, CC0, Wikimedia Commons' WHERE slug='gorohovaya-plodozhorka';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/didimella-purpurovaya-pyatnistost.jpg', image_credit='Jerzy Opiola, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='didimella-purpurovaya-pyatnistost';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/ramulyarioz.jpg', image_credit='Josef Schlaghecken, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='ramulyarioz';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/morkovnaya-listobloshka.jpg', image_credit='Jasmin Sauer, JKI, CC BY 4.0, Wikimedia Commons' WHERE slug='morkovnaya-listobloshka';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/slizistyy-bakterioz.jpg', image_credit='Scot Nelson, CC0, Wikimedia Commons' WHERE slug='slizistyy-bakterioz';
