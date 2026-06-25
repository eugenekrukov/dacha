-- 049_guide_images_3.sql
-- Третья волна фото справочника: добиваем «длинный хвост» из контент-долга (docs/plant-guide-plan.md).
-- Источник: Wikimedia Commons (CC0/CC-BY/CC-BY-SA/PD, лицензия проверена построчно, без Bugwood-вотермарок).
-- Идемпотентно: UPDATE по slug, повторный прогон переустанавливает те же значения.
-- Без фото остались (нет годного свободного кадра): boron-deficiency, fomopsis-suhaya-gnil,
-- fomoz-suhaya-gnil, lukovyy-skrytnohobotnik, uglovataya-pyatnistost-bakterioz (только Bugwood/гравюры/банан).

UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/askohitoz.jpg', image_credit='Peketichinna, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='askohitoz';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/bahchevaya-tlya.jpg', image_credit='Flowersabc, CC BY-SA 2.0, Wikimedia Commons' WHERE slug='bahchevaya-tlya';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/chernaya-nozhka.jpg', image_credit='Jochen Kreiselmaier, DLR Rheinpfalz, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='chernaya-nozhka';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/fuzarioz-gnil-dontsa.jpg', image_credit='Jochen Kreiselmaier, DLR Rheinpfalz, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='fuzarioz-gnil-dontsa';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/kornevaya-gnil.jpg', image_credit='Fk, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='kornevaya-gnil';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/kryzhovnikovaya-ognevka.jpg', image_credit='Ilia Ustyantsev, CC BY-SA 2.0, Wikimedia Commons' WHERE slug='kryzhovnikovaya-ognevka';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/sheykovaya-gnil.jpg', image_credit='Jochen Kreiselmaier, DLR Rheinpfalz, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='sheykovaya-gnil';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/steblevaya-nematoda.jpg', image_credit='Reinhard Eder, Agroscope Schweiz, CC BY 4.0, Wikimedia Commons' WHERE slug='steblevaya-nematoda';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/vertitsilleznoe-uvyadanie.jpg', image_credit='Brian Prechtel, USDA ARS (PD), Wikimedia Commons' WHERE slug='vertitsilleznoe-uvyadanie';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/zemlyanichnyy-klesch.jpg', image_credit='Hardyplants, CC0, Wikimedia Commons' WHERE slug='zemlyanichnyy-klesch';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/zontichnaya-tlya.jpg', image_credit='Jesse Rorabaugh, CC0, Wikimedia Commons' WHERE slug='zontichnaya-tlya';
