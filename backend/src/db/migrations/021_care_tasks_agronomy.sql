-- 021: Агрономическая выверка тайминга care_tasks по ВСЕМ 45 культурам (заменяет тайминги 008/020).
--
-- Точка отсчёта day_offset — planted_at = ДАТА ПОСЕВА. Для рассадных культур (transplant_days > 0)
-- стадийные работы (подвязка, пасынкование, окучивание, обработки) СДВИНУТЫ на +transplant_days,
-- чтобы не попадать в рассадный период. Для культур прямого посева — от посева/всходов.
-- Прореживание — только у прямого посева. repeat_days=null — однократно; иначе интервал повтора.
-- Первое наступление каждой задачи < harvest_days, чтобы попадало в расписание.

-- ════════════ РАССАДНЫЕ (offset = transplant_days + Δ) ════════════

-- Томат (рассада 60, урожай 110)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":67,"repeat_days":21},
  {"name":"Подвязка","day_offset":70,"repeat_days":14},
  {"name":"Пасынкование","day_offset":74,"repeat_days":10},
  {"name":"Обработка от фитофторы","day_offset":85,"repeat_days":14},
  {"name":"Прищипка верхушки","day_offset":100,"repeat_days":null}
]' WHERE name = 'Томат';

-- Огурец (рассада 30, урожай 60)
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":37,"repeat_days":14},
  {"name":"Подвязка","day_offset":40,"repeat_days":14},
  {"name":"Прищипка боковых побегов","day_offset":44,"repeat_days":null},
  {"name":"Прополка","day_offset":37,"repeat_days":21},
  {"name":"Обработка от мучнистой росы","day_offset":50,"repeat_days":null}
]' WHERE name = 'Огурец';

-- Перец (рассада 75, урожай 130)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":82,"repeat_days":21},
  {"name":"Подвязка","day_offset":85,"repeat_days":null},
  {"name":"Пасынкование","day_offset":90,"repeat_days":14},
  {"name":"Обрезка нижних листьев","day_offset":100,"repeat_days":null},
  {"name":"Обработка от тли","day_offset":95,"repeat_days":14}
]' WHERE name = 'Перец';

-- Перец острый (рассада 75, урожай 130)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":82,"repeat_days":21},
  {"name":"Подвязка","day_offset":85,"repeat_days":null},
  {"name":"Пасынкование","day_offset":90,"repeat_days":14},
  {"name":"Обработка от тли","day_offset":95,"repeat_days":14}
]' WHERE name = 'Перец острый';

-- Баклажан (рассада 75, урожай 140)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":82,"repeat_days":21},
  {"name":"Подвязка","day_offset":85,"repeat_days":null},
  {"name":"Пасынкование","day_offset":90,"repeat_days":14},
  {"name":"Обработка от колорадского жука","day_offset":90,"repeat_days":14},
  {"name":"Удаление лишних завязей","day_offset":110,"repeat_days":null}
]' WHERE name = 'Баклажан';

-- Капуста белокочанная (рассада 45, урожай 130)
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":52,"repeat_days":21},
  {"name":"Прополка","day_offset":52,"repeat_days":21},
  {"name":"Обработка от капустной мухи","day_offset":50,"repeat_days":null},
  {"name":"Первое окучивание","day_offset":60,"repeat_days":null},
  {"name":"Второе окучивание","day_offset":85,"repeat_days":null}
]' WHERE name = 'Капуста белокочанная';

-- Капуста цветная и брокколи (рассада 45, урожай 80)
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":52,"repeat_days":21},
  {"name":"Прополка","day_offset":52,"repeat_days":21},
  {"name":"Окучивание","day_offset":65,"repeat_days":null},
  {"name":"Обработка от капустной мухи","day_offset":50,"repeat_days":null}
]' WHERE name IN ('Капуста цветная','Капуста брокколи');

-- Капуста пекинская (рассада 25, урожай 50)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":32,"repeat_days":21},
  {"name":"Рыхление","day_offset":32,"repeat_days":21},
  {"name":"Обработка от капустной мухи","day_offset":30,"repeat_days":null}
]' WHERE name = 'Капуста пекинская';

-- Базилик (рассада 45, урожай 60 — короткое окно)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":50,"repeat_days":21},
  {"name":"Прищипка верхушки","day_offset":52,"repeat_days":14},
  {"name":"Удаление цветоносов","day_offset":58,"repeat_days":14}
]' WHERE name = 'Базилик';

-- Лук-порей (рассада 75, урожай 170 — окучивание для отбеливания ножки)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":82,"repeat_days":21},
  {"name":"Рыхление","day_offset":82,"repeat_days":21},
  {"name":"Окучивание","day_offset":100,"repeat_days":21}
]' WHERE name = 'Лук-порей';

-- Сельдерей (рассада 60, урожай 170 — окучивание черешкового)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":67,"repeat_days":21},
  {"name":"Рыхление","day_offset":67,"repeat_days":21},
  {"name":"Окучивание","day_offset":105,"repeat_days":21}
]' WHERE name = 'Сельдерей';

-- Арбуз и Дыня (рассада 30, урожай 90)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":37,"repeat_days":21},
  {"name":"Рыхление","day_offset":37,"repeat_days":21},
  {"name":"Прищипка плети (оставить 2-3 плода)","day_offset":55,"repeat_days":null},
  {"name":"Обработка от мучнистой росы","day_offset":60,"repeat_days":null}
]' WHERE name IN ('Арбуз','Дыня');

-- Мята (рассада/деленка 30, урожай 60)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":37,"repeat_days":21},
  {"name":"Рыхление","day_offset":44,"repeat_days":30},
  {"name":"Обрезка для кустистости","day_offset":50,"repeat_days":null}
]' WHERE name = 'Мята';

-- Тимьян (рассада 45, урожай 90)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":52,"repeat_days":21},
  {"name":"Рыхление","day_offset":60,"repeat_days":30},
  {"name":"Обрезка для кустистости","day_offset":65,"repeat_days":30}
]' WHERE name = 'Тимьян';

-- Ревень (деленка 60, урожай — многолетник)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":67,"repeat_days":21},
  {"name":"Рыхление","day_offset":75,"repeat_days":30},
  {"name":"Удаление цветоносов","day_offset":90,"repeat_days":21}
]' WHERE name = 'Ревень';

-- Бархатцы (рассада 30, урожай/цветение 75)
UPDATE crops SET care_tasks = '[
  {"name":"Прищипка верхушки","day_offset":40,"repeat_days":null},
  {"name":"Прополка","day_offset":37,"repeat_days":21},
  {"name":"Удаление увядших цветков","day_offset":55,"repeat_days":14}
]' WHERE name = 'Бархатцы';

-- Петуния (рассада 60, цветение 120)
UPDATE crops SET care_tasks = '[
  {"name":"Прищипка верхушки","day_offset":70,"repeat_days":null},
  {"name":"Прополка","day_offset":67,"repeat_days":21},
  {"name":"Удаление увядших цветков","day_offset":85,"repeat_days":14}
]' WHERE name = 'Петуния';

-- ════════════ ПРЯМОЙ ПОСЕВ (offset от посева/всходов) ════════════

-- Картофель (урожай 90)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":18,"repeat_days":21},
  {"name":"Первое окучивание","day_offset":25,"repeat_days":null},
  {"name":"Второе окучивание","day_offset":45,"repeat_days":null},
  {"name":"Обработка от колорадского жука","day_offset":30,"repeat_days":14},
  {"name":"Обработка от фитофторы","day_offset":50,"repeat_days":14}
]' WHERE name = 'Картофель';

-- Морковь (урожай 100)
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание (первое)","day_offset":21,"repeat_days":null},
  {"name":"Прореживание (второе)","day_offset":45,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":21}
]' WHERE name = 'Морковь';

-- Свёкла (урожай 90)
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":21,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":21}
]' WHERE name = 'Свёкла';

-- Редька и Репа (урожай 60)
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":14,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":21}
]' WHERE name IN ('Редька','Репа');

-- Пастернак (урожай 120)
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":21,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":30}
]' WHERE name = 'Пастернак';

-- Лук репчатый (урожай 100)
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Прекратить полив","day_offset":75,"repeat_days":null}
]' WHERE name = 'Лук репчатый';

-- Лук-батун (урожай 50)
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Лук-батун';

-- Чеснок (урожай 60)
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Удаление стрелок","day_offset":40,"repeat_days":null}
]' WHERE name = 'Чеснок';

-- Редис (урожай 25)
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":7,"repeat_days":null},
  {"name":"Прополка","day_offset":7,"repeat_days":14}
]' WHERE name = 'Редис';

-- Салат листовой (урожай 35)
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":14,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":14}
]' WHERE name = 'Салат листовой';

-- Шпинат (урожай 35)
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":14,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":14}
]' WHERE name = 'Шпинат';

-- Кинза (урожай 35)
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":14,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Кинза';

-- Укроп (урожай 40)
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":14,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Укроп';

-- Петрушка (урожай 60)
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":21,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Петрушка';

-- Щавель (урожай 60, многолетник)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":30},
  {"name":"Обрезка старых листьев","day_offset":40,"repeat_days":30}
]' WHERE name = 'Щавель';

-- Кабачок (прямой посев, урожай 55)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прищипка верхушки","day_offset":35,"repeat_days":null},
  {"name":"Обработка от мучнистой росы","day_offset":40,"repeat_days":null}
]' WHERE name = 'Кабачок';

-- Патиссон (прямой посев, урожай 50)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прищипка верхушки","day_offset":30,"repeat_days":null}
]' WHERE name = 'Патиссон';

-- Тыква (прямой посев, урожай 100)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прищипка плети (оставить 2-3 плода)","day_offset":40,"repeat_days":null},
  {"name":"Обработка от мучнистой росы","day_offset":50,"repeat_days":null}
]' WHERE name = 'Тыква';

-- Горох (урожай 70)
UPDATE crops SET care_tasks = '[
  {"name":"Установка опоры","day_offset":15,"repeat_days":null},
  {"name":"Подвязка","day_offset":20,"repeat_days":14},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Горох';

-- Фасоль стручковая (урожай 60)
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Прищипка верхушки","day_offset":35,"repeat_days":null}
]' WHERE name = 'Фасоль стручковая';

-- Кукуруза (урожай 90)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Окучивание","day_offset":30,"repeat_days":null},
  {"name":"Рыхление","day_offset":14,"repeat_days":21}
]' WHERE name = 'Кукуруза';

-- Хрен (урожай 180)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":30}
]' WHERE name = 'Хрен';

-- ════════════ ЯГОДНЫЕ (многолетники, от начала сезона) ════════════

-- Клубника (многолетник)
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Обработка от серой гнили","day_offset":20,"repeat_days":null},
  {"name":"Удаление усов","day_offset":30,"repeat_days":21}
]' WHERE name IN ('Клубника','Земляника');

-- Малина (многолетник)
UPDATE crops SET care_tasks = '[
  {"name":"Подвязка побегов","day_offset":20,"repeat_days":null},
  {"name":"Нормировка побегов","day_offset":30,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Обрезка отплодоносивших побегов","day_offset":90,"repeat_days":null}
]' WHERE name = 'Малина';

-- Смородина чёрная и Крыжовник (кусты, многолетники)
UPDATE crops SET care_tasks = '[
  {"name":"Обрезка санитарная","day_offset":15,"repeat_days":null},
  {"name":"Обработка от мучнистой росы","day_offset":25,"repeat_days":null},
  {"name":"Прополка","day_offset":20,"repeat_days":21},
  {"name":"Рыхление","day_offset":20,"repeat_days":30}
]' WHERE name IN ('Смородина чёрная','Крыжовник');
