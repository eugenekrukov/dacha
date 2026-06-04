-- 020: care_tasks для культур, у которых их не было (27 шт — добавлены пачкой в 006 + часть зелени/ягод).
-- Формат как в 008: [{"name","day_offset","repeat_days"}]. Имена согласованы с careTaskActionType
-- (прополк→weeding, рыхлен→loosening, окучив→hilling, подвяз→tying, пасынк/прищип→pinching,
-- обрезк→pruning, обработк→treatment). Прореживание/Удаление*/Опора/Нормировка — информационные.

-- ── Бахчевые (Арбуз, Дыня) ──
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прищипка плети (оставить 2-3 плода)","day_offset":40,"repeat_days":null},
  {"name":"Обработка от мучнистой росы","day_offset":45,"repeat_days":null}
]' WHERE name IN ('Арбуз','Дыня');

-- ── Патиссон ──
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прищипка верхушки","day_offset":35,"repeat_days":null}
]' WHERE name = 'Патиссон';

-- ── Капуста цветная и брокколи ──
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Окучивание","day_offset":25,"repeat_days":null},
  {"name":"Обработка от капустной мухи","day_offset":7,"repeat_days":null}
]' WHERE name IN ('Капуста цветная','Капуста брокколи');

-- ── Капуста пекинская (быстрая) ──
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":10,"repeat_days":null},
  {"name":"Прополка","day_offset":10,"repeat_days":21},
  {"name":"Обработка от капустной мухи","day_offset":7,"repeat_days":null}
]' WHERE name = 'Капуста пекинская';

-- ── Зелень: Кинза, Салат листовой, Шпинат ──
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":14,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name IN ('Кинза','Салат листовой','Шпинат');

-- ── Щавель (многолетник) ──
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":21},
  {"name":"Обрезка старых листьев","day_offset":40,"repeat_days":30}
]' WHERE name = 'Щавель';

-- ── Ягодные кусты: Крыжовник, Смородина чёрная ──
UPDATE crops SET care_tasks = '[
  {"name":"Обрезка санитарная","day_offset":15,"repeat_days":null},
  {"name":"Прополка","day_offset":20,"repeat_days":21},
  {"name":"Рыхление","day_offset":20,"repeat_days":30},
  {"name":"Обработка от мучнистой росы","day_offset":25,"repeat_days":null}
]' WHERE name IN ('Крыжовник','Смородина чёрная');

-- ── Кукуруза ──
UPDATE crops SET care_tasks = '[
  {"name":"Окучивание","day_offset":30,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":14,"repeat_days":21}
]' WHERE name = 'Кукуруза';

-- ── Лук-батун ──
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Лук-батун';

-- ── Лук-порей (окучивание для отбеливания ножки) ──
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Окучивание","day_offset":45,"repeat_days":21}
]' WHERE name = 'Лук-порей';

-- ── Многолетние травы: Мята, Тимьян ──
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":30},
  {"name":"Обрезка для кустистости","day_offset":45,"repeat_days":30}
]' WHERE name IN ('Мята','Тимьян');

-- ── Корнеплоды: Пастернак, Редька, Репа ──
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":21,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":21}
]' WHERE name IN ('Пастернак','Редька','Репа');

-- ── Перец острый ──
UPDATE crops SET care_tasks = '[
  {"name":"Пасынкование","day_offset":30,"repeat_days":14},
  {"name":"Подвязка","day_offset":25,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Перец острый';

-- ── Ревень (многолетник) ──
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":30},
  {"name":"Удаление цветоносов","day_offset":40,"repeat_days":21}
]' WHERE name = 'Ревень';

-- ── Сельдерей (окучивание черешкового) ──
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Окучивание","day_offset":45,"repeat_days":21}
]' WHERE name = 'Сельдерей';

-- ── Хрен (минимальный уход) ──
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":30}
]' WHERE name = 'Хрен';

-- ── Фасоль стручковая (в 008 был ключ 'Фасоль' — реальное имя 'Фасоль стручковая') ──
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Прищипка верхушки","day_offset":35,"repeat_days":null}
]' WHERE name = 'Фасоль стручковая';

-- ── Цветы: Бархатцы, Петуния ──
UPDATE crops SET care_tasks = '[
  {"name":"Прищипка верхушки","day_offset":20,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Удаление увядших цветков","day_offset":40,"repeat_days":14}
]' WHERE name IN ('Бархатцы','Петуния');
