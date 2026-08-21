-- Migration 085: install_referrer — сырой referrer установки (RuStore referrerId /
-- Google Play Install Referrer), чтобы атрибутировать регистрации из сторов к
-- рекламным кампаниям (сейчас это слепая зона — кнопки в лендинге на RuStore/GPlay
-- не передают utm обратно на сайт, см. память project_dacha_vk_ads_test).

ALTER TABLE users ADD COLUMN install_referrer TEXT;
