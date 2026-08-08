-- 064_crop_images.sql
-- Фото культур (55/55). Инфраструктура показа была готова с миграции 047 (crops.image_url +
-- вёрстка карточек), но сами файлы так и не залили — карточки культур в приложении и на сайте
-- стояли без картинок. Здесь проставляются ссылки и атрибуция.
--
-- Файлы: web/public/media/crops/<slug>.jpg (в репозитории, выезжают со сборкой веба в
-- /var/www/dacha-web) — тот же механизм, что у фото справочника (миграции 034/035/039/049).
-- Ширина 900 px, как у справочника.
--
-- Источник — Wikimedia Commons, только свободные лицензии (CC BY / CC BY-SA / CC0 / Public
-- domain). GFDL сознательно не берём: она требует прикладывать полный текст лицензии к
-- изображению. Автор и лицензия взяты из Commons API (extmetadata), не выдуманы; ссылки на
-- файлы-источники — backend/scripts/crop-images.sources.json.
-- Подбор воспроизводим: node backend/scripts/fetch-crop-images.js [slug ...]
--
-- Все 55 кадров просмотрены глазами перед коммитом: отбракованы ботанические гравюры
-- (чеснок, кукуруза, вишня, укроп), сканы каталогов семян XIX века, макро-разрезы вместо
-- плодов (малина), семена вместо корнеплода (пастернак) и цветение вместо ягод (вишня).
--
-- Идемпотентно: UPDATE по slug, повторный прогон переустанавливает те же значения.

UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/arbuz.jpg', image_credit='Fred Hsu, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='arbuz';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/baklazhan.jpg', image_credit='Joydeep, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='baklazhan';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/barhatcy.jpg', image_credit='Ezhuttukari, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='barhatcy';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/bazilik.jpg', image_credit='David J. Stang, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='bazilik';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/chereshnya.jpg', image_credit='spurekar, CC BY 2.0, Wikimedia Commons' WHERE slug='chereshnya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/chesnok.jpg', image_credit='Donovan Govan, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='chesnok';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/dynya.jpg', image_credit='Atomicbre, CC BY 3.0, Wikimedia Commons' WHERE slug='dynya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/ezhevika.jpg', image_credit='Ragesoss, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='ezhevika';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/fasol-struchkovaya.jpg', image_credit='Aldrina A Manashe, CC0, Wikimedia Commons' WHERE slug='fasol-struchkovaya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/goroh.jpg', image_credit='Bill Ebbesen, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='goroh';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/grusha.jpg', image_credit='Keith Weller, USDA ARS, Public domain, Wikimedia Commons' WHERE slug='grusha';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/hren.jpg', image_credit='Pethan, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='hren';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/kabachok.jpg', image_credit='Tony Hisgett, CC BY 2.0, Wikimedia Commons' WHERE slug='kabachok';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/kapusta-belokochannaya.jpg', image_credit='Bill Tarpenning, USDA, Public domain, Wikimedia Commons' WHERE slug='kapusta-belokochannaya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/kapusta-brokkoli.jpg', image_credit='Downtowngal, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='kapusta-brokkoli';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/kapusta-cvetnaya.jpg', image_credit='Coyau, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='kapusta-cvetnaya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/kapusta-pekinskaya.jpg', image_credit='Bayartai, CC0, Wikimedia Commons' WHERE slug='kapusta-pekinskaya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/kartofel.jpg', image_credit='Scott Bauer, USDA ARS, Public domain, Wikimedia Commons' WHERE slug='kartofel';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/kinza.jpg', image_credit='David J. Stang, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='kinza';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/klubnika.jpg', image_credit='Ivar Leidus, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='klubnika';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/kryzhovnik.jpg', image_credit='CC BY-SA 3.0, Wikimedia Commons' WHERE slug='kryzhovnik';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/kukuruza.jpg', image_credit='burgkirsch, CC BY-SA 2.5, Wikimedia Commons' WHERE slug='kukuruza';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/luk-batun.jpg', image_credit='Farm, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='luk-batun';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/luk-porey.jpg', image_credit='Amada44, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='luk-porey';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/luk-repchatyy.jpg', image_credit='Colin, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='luk-repchatyy';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/malina.jpg', image_credit='BraveNewWorld, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='malina';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/morkov.jpg', image_credit='Evan-Amos, Public domain, Wikimedia Commons' WHERE slug='morkov';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/myata.jpg', image_credit='C T Johansson, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='myata';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/ogurec.jpg', image_credit='Stephen Ausmus, USDA ARS, Public domain, Wikimedia Commons' WHERE slug='ogurec';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/pasternak.jpg', image_credit='Quadell, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='pasternak';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/patisson.jpg', image_credit='Public domain, Wikimedia Commons' WHERE slug='patisson';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/perec.jpg', image_credit='Kham Tran, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='perec';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/perec-ostryy.jpg', image_credit='Takeaway, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='perec-ostryy';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/petrushka.jpg', image_credit='H. Zell, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='petrushka';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/petuniya.jpg', image_credit='Gabriel Collares, CC BY 4.0, Wikimedia Commons' WHERE slug='petuniya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/redis.jpg', image_credit='Jengod, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='redis';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/redka.jpg', image_credit='San Juan del Sur, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='redka';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/repa.jpg', image_credit='thebittenword.com, CC BY 2.0, Wikimedia Commons' WHERE slug='repa';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/reven.jpg', image_credit='Dieter Weber, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='reven';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/salat-listovoy.jpg', image_credit='Geographer, CC BY 1.0, Wikimedia Commons' WHERE slug='salat-listovoy';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/schavel.jpg', image_credit='Didier Descouens, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='schavel';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/selderey.jpg', image_credit='Lombroso, Public domain, Wikimedia Commons' WHERE slug='selderey';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/shpinat.jpg', image_credit='Rasbak, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='shpinat';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/sliva.jpg', image_credit='Ivar Leidus, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='sliva';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/smorodina-belaya.jpg', image_credit='Rasbak, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='smorodina-belaya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/smorodina-chernaya.jpg', image_credit='Jerzy Opioła, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='smorodina-chernaya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/smorodina-krasnaya.jpg', image_credit='Ivar Leidus, CC BY-SA 4.0, Wikimedia Commons' WHERE slug='smorodina-krasnaya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/svekla.jpg', image_credit='BriannaWalther, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='svekla';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/timyan.jpg', image_credit='Kurt Stüber, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='timyan';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/tomat.jpg', image_credit='Softeis, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='tomat';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/tykva.jpg', image_credit='Infrogmation of New Orleans, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='tykva';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/ukrop.jpg', image_credit='Tepeyac, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='ukrop';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/vishnya.jpg', image_credit='böhringer friedrich, CC BY-SA 2.5, Wikimedia Commons' WHERE slug='vishnya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/yablonya.jpg', image_credit='Aomorikuma, CC BY-SA 3.0, Wikimedia Commons' WHERE slug='yablonya';
UPDATE crops SET image_url='https://dacha.studio1008.com/app/media/crops/zhimolost-sedobnaya.jpg', image_credit='Opioła Jerzy, CC BY 2.5, Wikimedia Commons' WHERE slug='zhimolost-sedobnaya';
