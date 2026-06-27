-- 050_guide_image_replace_vert.sql
-- Замена слабого фото вертициллёзного увядания (049) на референс с точным совпадением
-- симптома (баклажан, краевой хлороз/некроз снизу вверх). Источник: Wikimedia Commons,
-- CC BY 4.0, без Bugwood. Идемпотентно.

UPDATE guide_entries SET image_url='https://dacha.studio1008.com/app/media/guide/vertitsilleznoe-uvyadanie.jpg', image_credit='Josef Schlaghecken, CC BY 4.0, Wikimedia Commons' WHERE slug='vertitsilleznoe-uvyadanie';
