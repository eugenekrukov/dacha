-- 008: Add care_tasks to crops
-- Format: [{"name": "Окучивание", "day_offset": 30, "repeat_days": 21}]
-- day_offset  — дней от посадки до первого выполнения
-- repeat_days — интервал повтора (null = однократно)

ALTER TABLE crops ADD COLUMN IF NOT EXISTS care_tasks JSONB DEFAULT '[]';

-- ---- КАРТОФЕЛЬ ----
UPDATE crops SET care_tasks = '[
  {"name":"Первое окучивание","day_offset":25,"repeat_days":null},
  {"name":"Второе окучивание","day_offset":45,"repeat_days":null},
  {"name":"Прополка","day_offset":20,"repeat_days":21},
  {"name":"Обработка от фитофторы","day_offset":50,"repeat_days":14}
]' WHERE name = 'Картофель';

-- ---- ТОМАТ ----
UPDATE crops SET care_tasks = '[
  {"name":"Подвязка","day_offset":20,"repeat_days":14},
  {"name":"Пасынкование","day_offset":25,"repeat_days":10},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Прищипка верхушки","day_offset":80,"repeat_days":null}
]' WHERE name = 'Томат';

-- ---- ОГУРЕЦ ----
UPDATE crops SET care_tasks = '[
  {"name":"Подвязка","day_offset":14,"repeat_days":14},
  {"name":"Прищипка боковых побегов","day_offset":20,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":10,"repeat_days":14}
]' WHERE name = 'Огурец';

-- ---- ПЕРЕЦ ----
UPDATE crops SET care_tasks = '[
  {"name":"Пасынкование","day_offset":30,"repeat_days":14},
  {"name":"Подвязка","day_offset":25,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Обрезка нижних листьев","day_offset":40,"repeat_days":null}
]' WHERE name = 'Перец';

-- ---- КАПУСТА БЕЛОКОЧАННАЯ ----
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Первое окучивание","day_offset":20,"repeat_days":null},
  {"name":"Второе окучивание","day_offset":45,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Обработка от капустной мухи","day_offset":7,"repeat_days":null}
]' WHERE name = 'Капуста белокочанная';

-- ---- МОРКОВЬ ----
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание (первое)","day_offset":21,"repeat_days":null},
  {"name":"Прореживание (второе)","day_offset":45,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":21}
]' WHERE name = 'Морковь';

-- ---- ЛУК РЕПЧАТЫЙ ----
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Прекратить полив","day_offset":60,"repeat_days":null}
]' WHERE name = 'Лук репчатый';

-- ---- ЧЕСНОК ----
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":21,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Удаление стрелок","day_offset":60,"repeat_days":null}
]' WHERE name = 'Чеснок';

-- ---- СВЁКЛА ----
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":21,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Рыхление","day_offset":21,"repeat_days":21}
]' WHERE name = 'Свёкла';

-- ---- КАБАЧОК ----
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Прищипка верхушки","day_offset":35,"repeat_days":null},
  {"name":"Рыхление","day_offset":14,"repeat_days":21}
]' WHERE name = 'Кабачок';

-- ---- БАКЛАЖАН ----
UPDATE crops SET care_tasks = '[
  {"name":"Пасынкование","day_offset":25,"repeat_days":14},
  {"name":"Подвязка","day_offset":30,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Удаление лишних завязей","day_offset":50,"repeat_days":null}
]' WHERE name = 'Баклажан';

-- ---- ТЫКВА ----
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Прищипка (оставить 2 плода)","day_offset":40,"repeat_days":null},
  {"name":"Рыхление","day_offset":14,"repeat_days":21}
]' WHERE name = 'Тыква';

-- ---- ГОРОХ ----
UPDATE crops SET care_tasks = '[
  {"name":"Установка опоры","day_offset":15,"repeat_days":null},
  {"name":"Подвязка","day_offset":20,"repeat_days":14},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Горох';

-- ---- ФАСОЛЬ ----
UPDATE crops SET care_tasks = '[
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Прищипка верхушки","day_offset":35,"repeat_days":null}
]' WHERE name = 'Фасоль';

-- ---- КЛУБНИКА / ЗЕМЛЯНИКА ----
UPDATE crops SET care_tasks = '[
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Удаление усов","day_offset":30,"repeat_days":21},
  {"name":"Рыхление","day_offset":14,"repeat_days":21},
  {"name":"Обработка от серой гнили","day_offset":20,"repeat_days":null}
]' WHERE name IN ('Клубника','Земляника');

-- ---- РЕДИС ----
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":10,"repeat_days":null},
  {"name":"Прополка","day_offset":7,"repeat_days":14}
]' WHERE name = 'Редис';

-- ---- УКРОП ----
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":14,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Укроп';

-- ---- ПЕТРУШКА ----
UPDATE crops SET care_tasks = '[
  {"name":"Прореживание","day_offset":21,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Петрушка';

-- ---- БАЗИЛИК ----
UPDATE crops SET care_tasks = '[
  {"name":"Прищипка верхушки","day_offset":20,"repeat_days":14},
  {"name":"Удаление цветоносов","day_offset":40,"repeat_days":14},
  {"name":"Прополка","day_offset":14,"repeat_days":21}
]' WHERE name = 'Базилик';

-- ---- МАЛИНА ----
UPDATE crops SET care_tasks = '[
  {"name":"Подвязка побегов","day_offset":20,"repeat_days":null},
  {"name":"Прополка","day_offset":14,"repeat_days":21},
  {"name":"Обрезка отплодоносивших побегов","day_offset":75,"repeat_days":null},
  {"name":"Нормировка побегов","day_offset":30,"repeat_days":null}
]' WHERE name = 'Малина';
