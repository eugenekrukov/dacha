-- 065_guide_images_tail.sql
-- Хвост фото справочника проблем. Было 73 из 78 записей с фото, стало 76 из 78.
-- Механизм тот же, что у миграций 034/035/039/049: файл web/public/media/guide/<slug>.jpg
-- (в репозитории, выезжает со сборкой веба), ширина 900 px, источник Wikimedia Commons,
-- атрибуция «Автор, Лицензия, Wikimedia Commons».
--
-- Кадры подобраны вручную и сверены с тем, к каким культурам привязана запись
-- (crop_guide_entries) — для болезни важно показать её же на той же культуре:
--   uglovataya-pyatnistost-bakterioz → привязана к огурцу, фото угловатой пятнистости огурца;
--   fomopsis-suhaya-gnil            → привязана к баклажану, фото фомопсиса баклажана;
--   boron-deficiency                → без привязки к культуре, фото отмирания точки роста
--                                     (эндивий) — ровно тот симптом, что описан в записи.
--
-- Идемпотентно: UPDATE по slug.
--
-- ⚠️ Две записи СОЗНАТЕЛЬНО оставлены без фото — на Wikimedia Commons нет подходящего кадра,
-- а неверная картинка в справочнике болезней хуже её отсутствия (ведёт к ложному диагнозу):
--   fomoz-suhaya-gnil (привязан к моркови и свёкле) — есть только Phoma на всходах шпината
--     и Phoma lingam на капусте; описанных серо-коричневых пятен на корнеплодах они не показывают.
--   lukovyy-skrytnohobotnik (лук репчатый) — на Commons нет Ceutorhynchus suturalis, есть только
--     другие виды рода; для определителя вредителя снимок другого вида вводит в заблуждение.
-- Если появятся свои снимки — доложить сюда же новой миграцией.

UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/uglovataya-pyatnistost-bakterioz.jpg', image_credit='Howard F. Schwartz, Colorado State University, Bugwood.org, CC BY 3.0 US, Wikimedia Commons' WHERE slug='uglovataya-pyatnistost-bakterioz';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/fomopsis-suhaya-gnil.jpg', image_credit='Scot Nelson, CC0, Wikimedia Commons' WHERE slug='fomopsis-suhaya-gnil';
UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/boron-deficiency.jpg', image_credit='Jan Hinrichs-Berger, LTZ Augustenberg, CC BY 4.0, Wikimedia Commons' WHERE slug='boron-deficiency';
