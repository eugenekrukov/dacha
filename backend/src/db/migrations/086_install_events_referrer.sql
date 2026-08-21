-- Migration 086: install_referrer в install_events — атрибуция установки к рекламной
-- кампании (RuStore referrerId / Google Play Install Referrer). Это правильная точка
-- захвата: первый запуск, а не регистрация — часть установок так и не регистрируется,
-- см. память project_dacha_vk_ads_test. Дублирует users.install_referrer (085), которая
-- остаётся про запас, но с клиента больше не заполняется.

ALTER TABLE install_events ADD COLUMN install_referrer TEXT;
