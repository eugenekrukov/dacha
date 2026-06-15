-- 034_seed_guide_images.sql
-- Наполнение фото записей справочника проблем (источник: Wikimedia Commons).
-- Идемпотентно: UPDATE по slug, повторный прогон переустанавливает те же значения.
-- Дефициты по фото реальных растений; болезни/вредители — макро/полевые снимки.

UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/belokrylka.jpg', image_credit='Tashkoskim, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='belokrylka';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/calcium-deficiency.jpg', image_credit='Fructibus, CC0, Wikimedia Commons' WHERE slug='calcium-deficiency';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/colorado-beetle.jpg', image_credit='Scott Bauer, USDA ARS (PD), Wikimedia Commons' WHERE slug='colorado-beetle';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/fuzarioz.jpg', image_credit='Victor M. Vicente Selvas, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='fuzarioz';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/gray-mold.jpg', image_credit='Rasbak, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='gray-mold';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/iron-deficiency.jpg', image_credit='Eiku en exil, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='iron-deficiency';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/kapustnaya-belyanka.jpg', image_credit='Walter Baxter, CC BY-SA 2.0, Wikimedia Commons' WHERE slug='kapustnaya-belyanka';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/kapustnaya-tlya.jpg', image_credit='James K. Lindsey, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='kapustnaya-tlya';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/krestotsvetnaya-bloshka.jpg', image_credit='gailhampshire, CC BY 2.0, Wikimedia Commons' WHERE slug='krestotsvetnaya-bloshka';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/magnesium-deficiency.jpg', image_credit='Agronom, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='magnesium-deficiency';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/malinnyy-zhuk.jpg', image_credit='Wikimedia Commons (лицензия Attribution)' WHERE slug='malinnyy-zhuk';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/nitrogen-deficiency.jpg', image_credit='Rasbak, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='nitrogen-deficiency';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/peronosporoz-lozhnaya-muchnistaya-rosa.jpg', image_credit='Folini, CC BY 2.5, Wikimedia Commons' WHERE slug='peronosporoz-lozhnaya-muchnistaya-rosa';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/phosphorus-deficiency.jpg', image_credit='Agronom, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='phosphorus-deficiency';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/phytophthora.jpg', image_credit='Scot Nelson, CC0, Wikimedia Commons' WHERE slug='phytophthora';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/potassium-deficiency.jpg', image_credit='Goldlocki, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='potassium-deficiency';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/provolochnik.jpg', image_credit='ZATRIPPIT, CC0, Wikimedia Commons' WHERE slug='provolochnik';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/puzyrchataya-golovnya.jpg', image_credit='Björn S., CC BY-SA 2.0, Wikimedia Commons' WHERE slug='puzyrchataya-golovnya';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/schavelevyy-listoed.jpg', image_credit='gailhampshire, CC BY 2.0, Wikimedia Commons' WHERE slug='schavelevyy-listoed';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/septorioz.jpg', image_credit='MerielGJones, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='septorioz';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/slizni.jpg', image_credit='CC BY-SA 3.0, Wikimedia Commons' WHERE slug='slizni';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/spider-mite.jpg', image_credit='Gilles San Martin, CC BY-SA 2.0, Wikimedia Commons' WHERE slug='spider-mite';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/tlya.jpg', image_credit='Alvesgaspar, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='tlya';
