#!/usr/bin/env bash
# Скачивает фото болезней/вредителей деревьев и кустов (батч миграции 039) в media-папку
# веб-приложения. Источник — Wikimedia Commons; авторы/лицензии совпадают с image_credit в
# guide_entries (см. 039_guide_images_shrub_tree.sql). Идемпотентно: повторный прогон перезальёт.
#
# Почему скрипт нужен: миграция 039 проставляет image_url в БД, но сами JPG не в git —
# без этого скрипта на сервере их нет, и SPA-fallback отдаёт index.html (200/text-html),
# из-за чего фото деревьев «не отображаются». См. reference-dacha-web-static.
#
# Запуск на сервере:  bash download_guide_images_shrub_tree.sh
# (по умолчанию пишет в /var/www/dacha-web/media/guide — переопределить через GUIDE_DIR=…)

set -euo pipefail

DIR="${GUIDE_DIR:-/var/www/dacha-web/media/guide}"
UA="DachaKalendar/1.0 (+https://dacha.studio1008.com)"
mkdir -p "$DIR"
cd "$DIR"

# slug -> URL источника на Wikimedia (для крупных оригиналов берём 1280px-превью,
# чтобы карточки не весили мегабайты; остальные оригиналы уже ~50–360 КБ).
declare -A SRC=(
  [monilioz]="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Monilinia_disease_of_apple_01.jpg/1280px-Monilinia_disease_of_apple_01.jpg"
  [parsha-yabloni-grushi]="https://upload.wikimedia.org/wikipedia/commons/6/65/Venturia_inaequalis_01.JPG"
  [kokkomikoze]="https://upload.wikimedia.org/wikipedia/commons/3/35/Blumeriella_jaapii_01.JPG"
  [klasterosporioz]="https://upload.wikimedia.org/wikipedia/commons/c/c7/SchrotschussKirschblatt.jpg"
  [yablonevaya-plodozhorka]="https://upload.wikimedia.org/wikipedia/commons/5/5c/Gravenstein_apples_with_codling_moth.JPG"
  [yablonevyy-tsvetoyed]="https://upload.wikimedia.org/wikipedia/commons/5/50/Anthonomus_pomorum_01.JPG"
  [vishnevaya-muha]="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Kirschfruchtfliege_Rhagoletis_cerasi_2.jpg/1280px-Kirschfruchtfliege_Rhagoletis_cerasi_2.jpg"
  [schitovka-yablonevaya]="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Mussel_scale_on_an_apple.jpg/1280px-Mussel_scale_on_an_apple.jpg"
  [zelenaya-tlya-yablonevaya]="https://upload.wikimedia.org/wikipedia/commons/e/e7/Aphis_pomi_colony_on_crab_apple_in_East_Sussex.jpg"
  [smorodinnaya-gallovaya-tlya]="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Galle_Johannisbeerblasenlaus_Cryptomyzus_ribis.JPG/1280px-Galle_Johannisbeerblasenlaus_Cryptomyzus_ribis.JPG"
)

fail=0
for slug in "${!SRC[@]}"; do
  if curl -fsSL --retry 3 -A "$UA" -o "$slug.jpg" "${SRC[$slug]}"; then
    echo "OK   $slug.jpg ($(stat -c%s "$slug.jpg") B)"
  else
    echo "FAIL $slug" >&2
    fail=1
  fi
done

chmod 644 ./*.jpg
echo "Готово. Папка: $DIR"
exit $fail
