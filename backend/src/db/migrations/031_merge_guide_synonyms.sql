-- Migration 031: схлопывание синонимов в справочнике (по слугам).
-- Связи переезжают на канон (per-crop signs сохраняются), дубли удаляются. Идемпотентно.

INSERT INTO crop_guide_entries (crop_id, entry_id, signs)
  SELECT cg.crop_id, c.id, cg.signs FROM crop_guide_entries cg
  JOIN guide_entries c ON c.slug = 'peronosporoz-lozhnaya-muchnistaya-rosa'
  WHERE cg.entry_id IN (SELECT id FROM guide_entries WHERE slug IN ('peronosporoz', 'lozhnaya-muchnistaya-rosa'))
  ON CONFLICT (crop_id, entry_id) DO NOTHING;
DELETE FROM guide_entries WHERE slug IN ('peronosporoz', 'lozhnaya-muchnistaya-rosa');

INSERT INTO crop_guide_entries (crop_id, entry_id, signs)
  SELECT cg.crop_id, c.id, cg.signs FROM crop_guide_entries cg
  JOIN guide_entries c ON c.slug = 'gray-mold'
  WHERE cg.entry_id IN (SELECT id FROM guide_entries WHERE slug IN ('seraya-gnil-botrytis'))
  ON CONFLICT (crop_id, entry_id) DO NOTHING;
DELETE FROM guide_entries WHERE slug IN ('seraya-gnil-botrytis');

INSERT INTO crop_guide_entries (crop_id, entry_id, signs)
  SELECT cg.crop_id, c.id, cg.signs FROM crop_guide_entries cg
  JOIN guide_entries c ON c.slug = 'fomoz-suhaya-gnil'
  WHERE cg.entry_id IN (SELECT id FROM guide_entries WHERE slug IN ('fomoz'))
  ON CONFLICT (crop_id, entry_id) DO NOTHING;
DELETE FROM guide_entries WHERE slug IN ('fomoz');

INSERT INTO crop_guide_entries (crop_id, entry_id, signs)
  SELECT cg.crop_id, c.id, cg.signs FROM crop_guide_entries cg
  JOIN guide_entries c ON c.slug = 'muchnistaya-rosa-amerikanskaya-sferoteka'
  WHERE cg.entry_id IN (SELECT id FROM guide_entries WHERE slug IN ('muchnistaya-rosa-amerikanskaya'))
  ON CONFLICT (crop_id, entry_id) DO NOTHING;
DELETE FROM guide_entries WHERE slug IN ('muchnistaya-rosa-amerikanskaya');

INSERT INTO crop_guide_entries (crop_id, entry_id, signs)
  SELECT cg.crop_id, c.id, cg.signs FROM crop_guide_entries cg
  JOIN guide_entries c ON c.slug = 'fuzarioz'
  WHERE cg.entry_id IN (SELECT id FROM guide_entries WHERE slug IN ('fuzarioznoe-uvyadanie'))
  ON CONFLICT (crop_id, entry_id) DO NOTHING;
DELETE FROM guide_entries WHERE slug IN ('fuzarioznoe-uvyadanie');

INSERT INTO crop_guide_entries (crop_id, entry_id, signs)
  SELECT cg.crop_id, c.id, cg.signs FROM crop_guide_entries cg
  JOIN guide_entries c ON c.slug = 'zontichnaya-tlya'
  WHERE cg.entry_id IN (SELECT id FROM guide_entries WHERE slug IN ('tlya-zontichnaya'))
  ON CONFLICT (crop_id, entry_id) DO NOTHING;
DELETE FROM guide_entries WHERE slug IN ('tlya-zontichnaya');

INSERT INTO crop_guide_entries (crop_id, entry_id, signs)
  SELECT cg.crop_id, c.id, cg.signs FROM crop_guide_entries cg
  JOIN guide_entries c ON c.slug = 'belokrylka'
  WHERE cg.entry_id IN (SELECT id FROM guide_entries WHERE slug IN ('belokrylka-teplichnaya'))
  ON CONFLICT (crop_id, entry_id) DO NOTHING;
DELETE FROM guide_entries WHERE slug IN ('belokrylka-teplichnaya');

