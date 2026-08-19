-- Migration 083: «Плохие предшественники» (bad_predecessors) + докрутка пустых блоков соседства.
--
-- ПРИЧИНА: на вкладке «Соседи» показывались «Хорошие соседи», «Плохие соседи», «Хорошие
-- предшественники», но не было «Плохих предшественников» — колонки для них не существовало
-- вовсе (миграция 005 завела только good_neighbors/bad_neighbors/good_predecessors).
-- Плюс у части культур (Бархатцы, Кабачок, Кинза, Лук-порей и др.) не хватало даже уже
-- существующих блоков — массивы были пустыми.
--
-- bad_predecessors заполнен по принципу севооборота: не сажать после культур того же
-- ботанического семейства (family, миграция 053) — переносятся общие вредители/болезни
-- и истощаются одни и те же элементы почвы. Для семейств с одним представителем в БД
-- (Кукуруза, Жимолость) или где родство не даёт значимого агрономического конфликта
-- (пряные Яснотковые, декоративные Астровые/Петуния-цветник, Гречишные) — оставлено
-- пустым (DEFAULT '{}'), выдумывать список не стал.
--
-- Идемпотентна: прямой UPDATE по id, безопасно перегонять повторно.

ALTER TABLE crops ADD COLUMN IF NOT EXISTS bad_predecessors TEXT[] DEFAULT '{}';
COMMENT ON COLUMN crops.bad_predecessors IS
  'После каких культур сажать не стоит (общие болезни/вредители, истощение почвы) — обычно тот же ботанический class.family';

-- === Паслёновые: Томат, Перец, Баклажан, Картофель, Петуния, Перец острый ===
UPDATE crops SET bad_predecessors = ARRAY['Картофель','Перец','Баклажан'] WHERE id = 1;   -- Томат
UPDATE crops SET bad_predecessors = ARRAY['Томат','Картофель','Баклажан'] WHERE id = 3;   -- Перец
UPDATE crops SET bad_predecessors = ARRAY['Томат','Картофель','Перец'] WHERE id = 5;      -- Баклажан
UPDATE crops SET bad_predecessors = ARRAY['Томат','Перец','Баклажан'] WHERE id = 13;      -- Картофель
UPDATE crops SET bad_predecessors = ARRAY['Томат','Картофель','Перец'] WHERE id = 21;     -- Петуния
UPDATE crops SET bad_predecessors = ARRAY['Томат','Картофель','Баклажан'] WHERE id = 190; -- Перец острый

-- === Тыквенные: Огурец, Кабачок, Тыква, Патиссон, Арбуз, Дыня ===
UPDATE crops SET bad_predecessors = ARRAY['Кабачок','Тыква','Патиссон'] WHERE id = 2;    -- Огурец
UPDATE crops SET bad_predecessors = ARRAY['Огурец','Тыква','Патиссон'] WHERE id = 4;     -- Кабачок
UPDATE crops SET bad_predecessors = ARRAY['Огурец','Кабачок','Патиссон'] WHERE id = 169; -- Тыква
UPDATE crops SET bad_predecessors = ARRAY['Огурец','Кабачок','Тыква'] WHERE id = 170;    -- Патиссон
UPDATE crops SET bad_predecessors = ARRAY['Дыня','Огурец','Кабачок'] WHERE id = 188;     -- Арбуз
UPDATE crops SET bad_predecessors = ARRAY['Арбуз','Огурец','Кабачок'] WHERE id = 189;    -- Дыня

-- === Крестоцветные: капустные, Редис, Редька, Репа, Хрен ===
UPDATE crops SET bad_predecessors = ARRAY['Капуста цветная','Капуста брокколи','Редис','Редька'] WHERE id = 6;   -- Капуста белокочанная
UPDATE crops SET bad_predecessors = ARRAY['Капуста белокочанная','Капуста цветная','Редис'] WHERE id = 172;      -- Капуста брокколи
UPDATE crops SET bad_predecessors = ARRAY['Капуста белокочанная','Редис','Редька'] WHERE id = 173;               -- Капуста пекинская
UPDATE crops SET bad_predecessors = ARRAY['Капуста белокочанная','Капуста брокколи','Редис'] WHERE id = 171;     -- Капуста цветная
UPDATE crops SET bad_predecessors = ARRAY['Капуста белокочанная','Редька','Репа'] WHERE id = 11;                 -- Редис
UPDATE crops SET bad_predecessors = ARRAY['Редис','Репа','Капуста белокочанная'] WHERE id = 174;                 -- Редька
UPDATE crops SET bad_predecessors = ARRAY['Редис','Редька','Капуста белокочанная'] WHERE id = 175;               -- Репа
UPDATE crops SET bad_predecessors = ARRAY['Капуста белокочанная','Редис','Редька'] WHERE id = 191;               -- Хрен

-- === Зонтичные: Морковь, Укроп, Петрушка, Кинза, Сельдерей, Пастернак ===
UPDATE crops SET bad_predecessors = ARRAY['Укроп','Петрушка','Сельдерей','Пастернак'] WHERE id = 7;   -- Морковь
UPDATE crops SET bad_predecessors = ARRAY['Морковь','Петрушка','Сельдерей'] WHERE id = 14;             -- Укроп
UPDATE crops SET bad_predecessors = ARRAY['Морковь','Укроп','Сельдерей'] WHERE id = 15;                -- Петрушка
UPDATE crops SET bad_predecessors = ARRAY['Укроп','Морковь','Петрушка'] WHERE id = 17;                 -- Кинза
UPDATE crops SET bad_predecessors = ARRAY['Морковь','Укроп','Петрушка'] WHERE id = 183;                -- Сельдерей
UPDATE crops SET bad_predecessors = ARRAY['Морковь','Сельдерей','Петрушка'] WHERE id = 193;            -- Пастернак

-- === Маревые: Свёкла, Шпинат ===
UPDATE crops SET bad_predecessors = ARRAY['Шпинат'] WHERE id = 8;   -- Свёкла
UPDATE crops SET bad_predecessors = ARRAY['Свёкла'] WHERE id = 178; -- Шпинат

-- === Луковые: Лук репчатый, Чеснок, Лук-порей, Лук-батун ===
UPDATE crops SET bad_predecessors = ARRAY['Чеснок','Лук-порей','Лук-батун'] WHERE id = 9;   -- Лук репчатый
UPDATE crops SET bad_predecessors = ARRAY['Лук репчатый','Лук-порей'] WHERE id = 10;         -- Чеснок
UPDATE crops SET bad_predecessors = ARRAY['Лук репчатый','Чеснок'] WHERE id = 176;           -- Лук-порей
UPDATE crops SET bad_predecessors = ARRAY['Лук репчатый','Чеснок'] WHERE id = 177;           -- Лук-батун

-- === Бобовые: Горох, Фасоль стручковая ===
UPDATE crops SET bad_predecessors = ARRAY['Фасоль стручковая'] WHERE id = 180; -- Горох
UPDATE crops SET bad_predecessors = ARRAY['Горох'] WHERE id = 181;             -- Фасоль стручковая

-- === Розоцветные (многолетники — «предшественник» = что росло на месте посадки раньше;
--     общие возбудители корневой гнили/вертициллёза переносятся между родственными культурами) ===
UPDATE crops SET bad_predecessors = ARRAY['Малина','Ежевика'] WHERE id = 18;    -- Клубника
UPDATE crops SET bad_predecessors = ARRAY['Клубника','Ежевика'] WHERE id = 19;  -- Малина
UPDATE crops SET bad_predecessors = ARRAY['Малина','Клубника'] WHERE id = 518;  -- Ежевика
UPDATE crops SET bad_predecessors = ARRAY['Груша','Вишня','Слива'] WHERE id = 520; -- Яблоня
UPDATE crops SET bad_predecessors = ARRAY['Яблоня'] WHERE id = 521;             -- Груша
UPDATE crops SET bad_predecessors = ARRAY['Черешня','Слива'] WHERE id = 522;    -- Вишня
UPDATE crops SET bad_predecessors = ARRAY['Вишня','Слива'] WHERE id = 523;      -- Черешня
UPDATE crops SET bad_predecessors = ARRAY['Вишня','Черешня'] WHERE id = 524;    -- Слива

-- === Крыжовниковые: Смородина ч/к/б, Крыжовник ===
UPDATE crops SET bad_predecessors = ARRAY['Крыжовник','Смородина красная','Смородина белая'] WHERE id = 186; -- Смородина чёрная
UPDATE crops SET bad_predecessors = ARRAY['Крыжовник','Смородина чёрная'] WHERE id = 516;                     -- Смородина красная
UPDATE crops SET bad_predecessors = ARRAY['Крыжовник','Смородина чёрная'] WHERE id = 517;                     -- Смородина белая
UPDATE crops SET bad_predecessors = ARRAY['Смородина чёрная','Смородина красная','Смородина белая'] WHERE id = 187; -- Крыжовник

-- ===========================================================
-- Докрутка пустых блоков good_neighbors / bad_neighbors / good_predecessors
-- у культур, где их не хватало (проверено выборкой из прода 2026-08-19).
-- ===========================================================

-- Петуния — декоративная, но семейство Паслёновые: рядом с тыквенными нормально,
-- избегать соседства с другими паслёновыми (общая фитофтора).
UPDATE crops SET bad_neighbors = ARRAY['Томат','Картофель'],
                  good_predecessors = ARRAY['Бобовые','Сидераты']
WHERE id = 21;

-- Хрен — сильно разрастается и глушит соседей корневой системой.
UPDATE crops SET bad_neighbors = ARRAY['Капуста','Свёкла'],
                  good_predecessors = ARRAY['Огурец','Картофель']
WHERE id = 191;

-- Щавель — нейтральная культура, хороших соседей раньше не было указано.
UPDATE crops SET good_neighbors = ARRAY['Капуста','Лук'] WHERE id = 179;

-- Кинза — угнетается фенхелем (общий эфирномасличный антагонизм зонтичных).
-- Укроп НЕ включаем: он уже в good_neighbors этой культуры (заведено раньше) —
-- не дублируем культуру одновременно в хорошие и плохие соседи.
UPDATE crops SET bad_neighbors = ARRAY['Фенхель'],
                  good_predecessors = ARRAY['Капуста','Огурец']
WHERE id = 17;

-- Крыжовник.
UPDATE crops SET good_predecessors = ARRAY['Бобовые','Сидераты'] WHERE id = 187;

-- Мята — агрессивно разрастается, подавляет медленнорастущие пряности рядом.
UPDATE crops SET bad_neighbors = ARRAY['Петрушка','Ромашка'],
                  good_predecessors = ARRAY['Бобовые','Капуста']
WHERE id = 184;

-- Бархатцы — защитное растение-компаньон, выраженных антагонистов не имеет
-- (тот же принцип уже используется у Жимолости, id=519).
UPDATE crops SET bad_neighbors = ARRAY['Нет антагонистов — универсальное защитное растение'],
                  good_predecessors = ARRAY['Бобовые','Злаки']
WHERE id = 20;

-- Лук-батун.
UPDATE crops SET good_predecessors = ARRAY['Капуста','Огурец'] WHERE id = 177;

-- Пастернак.
UPDATE crops SET good_predecessors = ARRAY['Капуста','Картофель','Лук'] WHERE id = 193;

-- Тимьян.
UPDATE crops SET good_predecessors = ARRAY['Бобовые','Капуста'] WHERE id = 185;

-- Капуста пекинская — классические плохие соседи капустных.
UPDATE crops SET bad_neighbors = ARRAY['Клубника','Томат'] WHERE id = 173;

-- Лук-порей — бобовые плохо соседствуют с луковыми (как и у лука репчатого).
UPDATE crops SET bad_neighbors = ARRAY['Горох','Фасоль стручковая'] WHERE id = 176;

-- Ревень — многолетник, конкурирует за влагу и свет со щавелем на одной грядке.
UPDATE crops SET bad_neighbors = ARRAY['Щавель'],
                  good_predecessors = ARRAY['Бобовые','Сидераты']
WHERE id = 192;

-- Базилик.
UPDATE crops SET good_predecessors = ARRAY['Капуста','Огурец','Лук'] WHERE id = 16;

-- Петрушка.
UPDATE crops SET good_predecessors = ARRAY['Капуста','Лук','Огурец'] WHERE id = 15;

-- Шпинат — тот же класс (Маревые), что и свёкла: конкуренция и общие вредители.
UPDATE crops SET bad_neighbors = ARRAY['Свёкла'],
                  good_predecessors = ARRAY['Капуста','Лук','Картофель']
WHERE id = 178;

-- Патиссон — тыквенные плохо соседствуют с картофелем и другими тыквенными.
UPDATE crops SET bad_neighbors = ARRAY['Картофель','Тыква'] WHERE id = 170;

-- Укроп.
UPDATE crops SET good_predecessors = ARRAY['Капуста','Картофель','Огурец'] WHERE id = 14;

-- Кабачок — тыквенные плохо соседствуют с картофелем и другими тыквенными.
UPDATE crops SET bad_neighbors = ARRAY['Картофель','Тыква'] WHERE id = 4;

-- Салат листовой — конкуренция за влагу и затенение от крупных капустных.
UPDATE crops SET bad_neighbors = ARRAY['Капуста брокколи'] WHERE id = 12;

-- Репа — тот же класс (Крестоцветные), общие вредители (крестоцветная блошка).
UPDATE crops SET bad_neighbors = ARRAY['Капуста','Редька'] WHERE id = 175;
