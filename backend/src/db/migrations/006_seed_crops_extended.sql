-- Migration 006: Full crops dictionary v2 — ~50 культур с агрономическими данными
-- Обновляет существующие 21 культуру + добавляет 29 новых
-- Климатические зоны: "3"=Сибирь/ДВ, "4"=Урал/Юж.Сибирь, "5"=Средняя полоса, "6"=Юг РФ
-- Дни года: Mar1=60 Apr1=91 May1=121 Jun1=152 Jul1=182 Aug1=213 Sep1=244

-- ============================================================
-- ЧАСТЬ 1: ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ КУЛЬТУР
-- ============================================================

-- ---- ТОМАТ ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":32,"sow_end":55,"transplant_start":100,"transplant_end":120},
    "5": {"sow_start":56,"sow_end":79,"transplant_start":130,"transplant_end":145},
    "4": {"sow_start":70,"sow_end":90,"transplant_start":145,"transplant_end":160},
    "3": {"sow_start":80,"sow_end":100,"transplant_start":158,"transplant_end":172}
  }',
  watering_details = '{
    "seedling":  {"freq_days":4,"amount_l_m2":3},
    "sprouted":  {"freq_days":3,"amount_l_m2":4},
    "growing":   {"freq_days":3,"amount_l_m2":6},
    "flowering": {"freq_days":2,"amount_l_m2":8},
    "fruiting":  {"freq_days":2,"amount_l_m2":10},
    "notes": "Поливать тёплой водой 18-20°C строго под корень. Избегать попадания на листья. Не допускать пересыхания в период налива плодов."
  }',
  fertilizing_schedule = '[
    {"stage":"seedling","timing":"Через 10-14 дней после появления всходов","fertilizer_type":"N","product_example":"Нитрофоска","dose":"10 г на 10 л воды","method":"root","notes":"После появления 2-3 настоящих листьев"},
    {"stage":"growing","timing":"Через 2 недели после высадки в грунт","fertilizer_type":"NPK","product_example":"Кемира Универсал","dose":"20 г на 10 л","method":"root","notes":"Стимулирует наращивание корневой системы"},
    {"stage":"flowering","timing":"При появлении первых цветочных кистей","fertilizer_type":"PK","product_example":"Монофосфат калия","dose":"15 г на 10 л","method":"root","notes":"Азот резко снижаем, упор на фосфор и калий"},
    {"stage":"fruiting","timing":"Каждые 10-14 дней","fertilizer_type":"K","product_example":"Сульфат калия","dose":"20 г на 10 л","method":"root","notes":"Улучшает вкус и лёжкость плодов"}
  ]',
  diseases = '[
    {"name":"Фитофтороз","symptoms":"Бурые маслянистые пятна на листьях и плодах, белый налёт на нижней стороне листа в сырую погоду","conditions":"Влажность >75%, перепады температур 10-15°C","treatment":"Ридомил Голд, Превикур Энерджи, бордоская смесь 1%","prevention":"Проветривание теплицы, мульчирование, не поливать по листьям"},
    {"name":"Кладоспориоз (бурая пятнистость)","symptoms":"Светло-жёлтые пятна на верхней стороне листьев, бархатистый оливково-серый налёт снизу","conditions":"Влажность >90%, температура 22-25°C","treatment":"ХОМ, Полихом, Квадрис, бордоская смесь","prevention":"Снижение влажности, удаление нижних листьев"},
    {"name":"Вершинная гниль","symptoms":"Тёмные водянистые пятна у вершины плода, плод сморщивается и чернеет","conditions":"Дефицит кальция, неравномерный полив, высокая температура","treatment":"Кальциевая селитра 0,4% (опрыскивание), Брексил Кальций","prevention":"Регулярный равномерный полив, мульчирование"},
    {"name":"Серая гниль","symptoms":"Водянистые пятна, пушистый серый налёт на всех частях растения","conditions":"Влажность >80%, температура 15-22°C, загущённые посадки","treatment":"Фундазол, Свитч, биопрепарат Трихоцин","prevention":"Прореживание, удаление повреждённых частей"},
    {"name":"Фузариозное увядание","symptoms":"Пожелтение и увядание нижних листьев, потемнение сосудов при срезе стебля","conditions":"Кислая почва, переувлажнение, зараженный грунт","treatment":"Превикур, Фундазол (профилактика), замена грунта","prevention":"Севооборот, обеззараживание почвы, устойчивые сорта"}
  ]',
  pests = '[
    {"name":"Белокрылка тепличная","signs":"Мелкие белые мошки на нижней стороне листьев, липкий медвяный налёт, пожелтение листьев","treatment":"Актара, Конфидор Макси, Биотлин; жёлтые клеевые ловушки","prevention":"Проветривание, жёлтые ловушки с начала сезона"},
    {"name":"Тля","signs":"Колонии мелких зелёных/чёрных насекомых на молодых побегах, скручивание листьев","treatment":"Актеллик, Фитоверм, мыльный раствор 0,5%, настой чеснока","prevention":"Бархатцы рядом, привлечение хищников (сирфиды, божьи коровки)"},
    {"name":"Колорадский жук","signs":"Оранжевые яйца и личинки на листьях, объеденная листовая пластинка","treatment":"Актара, Командор, Колорадо","prevention":"Мульчирование соломой, ручной сбор, горчица как сидерат"}
  ]',
  good_neighbors = '{"Базилик","Петрушка","Морковь","Лук репчатый","Чеснок","Редис","Бархатцы","Шпинат"}',
  bad_neighbors  = '{"Огурец","Картофель","Укроп","Фенхель","Репа","Горох"}',
  good_predecessors = '{"Бобовые","Лук","Ранняя капуста","Огурец","Зелень"}'
WHERE name = 'Томат';

-- ---- ОГУРЕЦ ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":100,"sow_end":120,"transplant_start":115,"transplant_end":135},
    "5": {"sow_start":121,"sow_end":140,"transplant_start":135,"transplant_end":152},
    "4": {"sow_start":130,"sow_end":148,"transplant_start":145,"transplant_end":163},
    "3": {"sow_start":140,"sow_end":158,"transplant_start":158,"transplant_end":175}
  }',
  watering_details = '{
    "seedling":  {"freq_days":2,"amount_l_m2":4},
    "growing":   {"freq_days":2,"amount_l_m2":6},
    "flowering": {"freq_days":1,"amount_l_m2":8},
    "fruiting":  {"freq_days":1,"amount_l_m2":10},
    "notes": "Поливать только тёплой водой (20-25°C). Холодный полив вызывает прикорневую гниль. Лучше ежедневно небольшими порциями. Мульчирование обязательно."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Мочевина","dose":"10 г на 10 л","method":"root","notes":"Активный рост листьев и стеблей"},
    {"stage":"flowering","timing":"В начале цветения","fertilizer_type":"NPK","product_example":"Нитроаммофоска","dose":"15 г на 10 л","method":"root","notes":"Сбалансированная подкормка"},
    {"stage":"fruiting","timing":"Каждые 10-12 дней","fertilizer_type":"K","product_example":"Калимагнезия","dose":"20 г на 10 л","method":"root","notes":"Продлевает плодоношение, предотвращает горечь"}
  ]',
  diseases = '[
    {"name":"Мучнистая роса","symptoms":"Белый мучнистый налёт на листьях, постепенно лист желтеет и засыхает","conditions":"Перепады температур, высокая влажность, сухая почва при влажном воздухе","treatment":"Коллоидная сера, Топаз, Квадрис, раствор соды (5 г + 5 г мыла на 1 л)","prevention":"Проветривание, избегать резких перепадов температур"},
    {"name":"Пероноспороз (ложная мучнистая роса)","symptoms":"Угловатые жёлто-зелёные пятна на верхней стороне листьев, серо-фиолетовый налёт снизу","conditions":"Влажность >80%, температура 12-18°C, обильные росы","treatment":"Ридомил Голд, Ордан, бордоская смесь","prevention":"Полив только под корень, проветривание, устойчивые сорта"},
    {"name":"Корневая гниль","symptoms":"Пожелтение нижних листьев, потемнение основания стебля, увядание в жару","conditions":"Холодный полив, переувлажнение, кислая почва","treatment":"Превикур Энерджи, Триходерма вериде (биопрепарат)","prevention":"Тёплая вода для полива, рыхление, посыпать основание золой"},
    {"name":"Угловатая пятнистость (бактериоз)","symptoms":"Угловатые мокрые пятна на листьях, ограниченные жилками, подсыхают и выпадают","conditions":"Дождливая погода, механические повреждения","treatment":"ХОМ, бордоская смесь, Фитолавин","prevention":"Обеззараживание семян, профилактические опрыскивания"}
  ]',
  pests = '[
    {"name":"Паутинный клещ","signs":"Мелкие точки на листьях, тонкая паутина, листья бледнеют и засыхают","treatment":"Фитоверм, Акарин, Клещевит; опрыскивание водой (клещ не любит влагу)","prevention":"Поддерживать влажность воздуха >70%, опрыскивать листья снизу"},
    {"name":"Бахчевая тля","signs":"Колонии под листьями и на молодых побегах, скручивание верхушек","treatment":"Актара, Биотлин, мыльный раствор, зольный настой","prevention":"Своевременное уничтожение сорняков, бархатцы рядом"},
    {"name":"Белокрылка","signs":"Белые мошки, липкий налёт, пожелтение листьев","treatment":"Актара, Конфидор, жёлтые клеевые ловушки","prevention":"Проветривание, поддержание умеренной температуры"}
  ]',
  good_neighbors = '{"Укроп","Лук репчатый","Чеснок","Горох","Фасоль","Морковь","Кукуруза","Сельдерей"}',
  bad_neighbors  = '{"Томат","Картофель","Редис","Базилик","Розмарин","Шалфей"}',
  good_predecessors = '{"Горох","Картофель","Лук","Капуста","Бобовые"}'
WHERE name = 'Огурец';

-- ---- ПЕРЕЦ ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":25,"sow_end":45,"transplant_start":105,"transplant_end":121},
    "5": {"sow_start":46,"sow_end":70,"transplant_start":135,"transplant_end":150},
    "4": {"sow_start":65,"sow_end":85,"transplant_start":152,"transplant_end":165},
    "3": {"sow_start":80,"sow_end":95,"transplant_start":163,"transplant_end":175}
  }',
  watering_details = '{
    "seedling":  {"freq_days":4,"amount_l_m2":2},
    "growing":   {"freq_days":3,"amount_l_m2":5},
    "flowering": {"freq_days":2,"amount_l_m2":7},
    "fruiting":  {"freq_days":2,"amount_l_m2":8},
    "notes": "Перец очень чувствителен к холодной воде — только тёплая (25°C). Не переливать: корни загнивают. Умеренный, равномерный полив."
  }',
  fertilizing_schedule = '[
    {"stage":"seedling","timing":"Через 2 недели после пикировки","fertilizer_type":"NPK","product_example":"Агрикола для томатов и перцев","dose":"5 г на 5 л","method":"root","notes":"Слабый раствор"},
    {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Нитроаммофоска","dose":"15 г на 10 л","method":"root","notes":"Стимуляция роста"},
    {"stage":"flowering","timing":"При появлении бутонов","fertilizer_type":"PK","product_example":"Монофосфат калия","dose":"15 г на 10 л","method":"foliar","notes":"Внекорневая подкормка по листьям утром"},
    {"stage":"fruiting","timing":"Каждые 2 недели","fertilizer_type":"K","product_example":"Сульфат калия","dose":"20 г на 10 л","method":"root","notes":"Поддержание плодоношения"}
  ]',
  diseases = '[
    {"name":"Фитофтороз","symptoms":"Бурые пятна на листьях и плодах, белый налёт при влажности","conditions":"Высокая влажность, холодные ночи","treatment":"Ридомил Голд, Превикур, бордоская смесь","prevention":"Проветривание, мульчирование"},
    {"name":"Вершинная гниль","symptoms":"Тёмные пятна у вершины плода","conditions":"Дефицит кальция, нерегулярный полив","treatment":"Кальциевая селитра 0,4% опрыскивание","prevention":"Равномерный полив, мульчирование"},
    {"name":"Серая гниль","symptoms":"Серый пушистый налёт на стеблях и плодах","conditions":"Высокая влажность, загущённые посадки","treatment":"Свитч, Фундазол","prevention":"Прореживание, удаление нижних листьев"}
  ]',
  pests = '[
    {"name":"Тля персиковая","signs":"Колонии на молодых побегах, деформация листьев","treatment":"Актеллик, Конфидор, мыльный раствор","prevention":"Бархатцы рядом"},
    {"name":"Паутинный клещ","signs":"Паутина и обесцвеченные точки на листьях","treatment":"Фитоверм, Акарин","prevention":"Поддержание влажности воздуха"},
    {"name":"Белокрылка","signs":"Белые мошки, жёлтые пятна на листьях","treatment":"Актара, жёлтые ловушки","prevention":"Проветривание теплицы"}
  ]',
  good_neighbors = '{"Баклажан","Базилик","Морковь","Лук","Бархатцы"}',
  bad_neighbors  = '{"Горох","Фенхель","Фасоль"}',
  good_predecessors = '{"Бобовые","Капуста","Огурец","Лук"}'
WHERE name = 'Перец';

-- ---- КАБАЧОК ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":105,"sow_end":121,"transplant_start":121,"transplant_end":140},
    "5": {"sow_start":121,"sow_end":140,"transplant_start":140,"transplant_end":155},
    "4": {"sow_start":130,"sow_end":148,"transplant_start":148,"transplant_end":163},
    "3": {"sow_start":140,"sow_end":155,"transplant_start":158,"transplant_end":172}
  }',
  watering_details = '{
    "growing":   {"freq_days":4,"amount_l_m2":8},
    "flowering": {"freq_days":3,"amount_l_m2":10},
    "fruiting":  {"freq_days":3,"amount_l_m2":12},
    "notes": "Поливать под корень, не попадая на листья и цветы. Обильный полив. Мульчирование обязательно. При жаре — ежедневно."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Мочевина","dose":"15 г на 10 л","method":"root","notes":"Стимуляция роста листьев"},
    {"stage":"flowering","timing":"При начале цветения","fertilizer_type":"NPK","product_example":"Нитрофоска","dose":"20 г на 10 л","method":"root","notes":"Поддержка опыления и завязи"},
    {"stage":"fruiting","timing":"Каждые 2 недели","fertilizer_type":"K","product_example":"Зола (настой)","dose":"1 стакан на 10 л воды","method":"root","notes":"Народное средство — эффективно"}
  ]',
  diseases = '[
    {"name":"Мучнистая роса","symptoms":"Белый налёт на листьях, листья желтеют и усыхают","conditions":"Сухой жаркий период, потом влага","treatment":"Коллоидная сера, Топаз, раствор соды","prevention":"Проветривание, не переувлажнять листья"},
    {"name":"Серая гниль","symptoms":"Серый налёт на плодах и стеблях","conditions":"Влажность, механические повреждения","treatment":"Фундазол, Свитч","prevention":"Удалять завядшие цветки с плодов"}
  ]',
  pests = '[
    {"name":"Бахчевая тля","signs":"Колонии на нижней стороне листьев, скручивание","treatment":"Актара, мыльный раствор, настой золы","prevention":"Бархатцы, укроп рядом"},
    {"name":"Слизни","signs":"Объеденные листья, серебристые следы","treatment":"Метальдегид (Гроза), зола вокруг растений","prevention":"Рыхление почвы, сухая мульча"}
  ]',
  good_neighbors = '{"Кукуруза","Лук","Свёкла","Томат","Фасоль","Укроп","Бархатцы"}',
  bad_neighbors  = '{}',
  good_predecessors = '{"Картофель","Капуста","Лук","Бобовые","Зелень"}'
WHERE name = 'Кабачок';

-- ---- БАКЛАЖАН ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":25,"sow_end":50,"transplant_start":110,"transplant_end":125},
    "5": {"sow_start":50,"sow_end":70,"transplant_start":140,"transplant_end":155},
    "4": {"sow_start":65,"sow_end":85,"transplant_start":155,"transplant_end":168},
    "3": {"sow_start":75,"sow_end":92,"transplant_start":165,"transplant_end":178}
  }',
  watering_details = '{
    "seedling":  {"freq_days":4,"amount_l_m2":2},
    "growing":   {"freq_days":3,"amount_l_m2":5},
    "flowering": {"freq_days":2,"amount_l_m2":7},
    "fruiting":  {"freq_days":2,"amount_l_m2":8},
    "notes": "Самая теплолюбивая культура. Полив только тёплой водой. При температуре ниже 15°C рост прекращается."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"NPK","product_example":"Кемира","dose":"20 г на 10 л","method":"root","notes":""},
    {"stage":"flowering","timing":"В начале цветения","fertilizer_type":"PK","product_example":"Монофосфат калия","dose":"15 г на 10 л","method":"root","notes":"Снизить долю азота"},
    {"stage":"fruiting","timing":"Каждые 2 недели","fertilizer_type":"K","product_example":"Сульфат калия","dose":"20 г на 10 л","method":"root","notes":""}
  ]',
  diseases = '[
    {"name":"Фомопсис (сухая гниль)","symptoms":"Светлые пятна с тёмным ободком на листьях, затем стебель и плоды","conditions":"Высокая влажность и температура","treatment":"ХОМ, Скор","prevention":"Севооборот, обеззараживание семян"},
    {"name":"Вертициллёзное увядание","symptoms":"Пожелтение и увядание снизу вверх","conditions":"Заражённая почва","treatment":"Профилактика Превикуром","prevention":"Севооборот минимум 4 года, устойчивые сорта"}
  ]',
  pests = '[
    {"name":"Колорадский жук","signs":"Яйца и личинки на листьях, полное объедание","treatment":"Актара, Командор, ручной сбор","prevention":"Мульчирование соломой"},
    {"name":"Паутинный клещ","signs":"Паутина, обесцвечивание листьев","treatment":"Фитоверм, Акарин","prevention":"Опрыскивание листьев водой"}
  ]',
  good_neighbors = '{"Перец","Фасоль","Лук","Зелень"}',
  bad_neighbors  = '{"Горох","Фенхель","Огурец"}',
  good_predecessors = '{"Огурец","Капуста","Бобовые","Лук"}'
WHERE name = 'Баклажан';

-- ---- КАПУСТА БЕЛОКОЧАННАЯ ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":60,"sow_end":91,"transplant_start":91,"transplant_end":121},
    "5": {"sow_start":74,"sow_end":100,"transplant_start":110,"transplant_end":135},
    "4": {"sow_start":85,"sow_end":110,"transplant_start":121,"transplant_end":145},
    "3": {"sow_start":95,"sow_end":115,"transplant_start":135,"transplant_end":155}
  }',
  watering_details = '{
    "seedling":  {"freq_days":3,"amount_l_m2":3},
    "growing":   {"freq_days":3,"amount_l_m2":8},
    "fruiting":  {"freq_days":2,"amount_l_m2":12},
    "notes": "Влаголюбивая культура. В жару поливать ежедневно. В период формирования кочана — особенно обильно. За 2 недели до уборки полив прекратить."
  }',
  fertilizing_schedule = '[
    {"stage":"seedling","timing":"В фазе 3-4 листьев","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"10 г на 10 л","method":"root","notes":""},
    {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Мочевина","dose":"10 г на 10 л","method":"root","notes":"Активный рост листьев"},
    {"stage":"fruiting","timing":"При завязывании кочана","fertilizer_type":"PK","product_example":"Нитрофоска","dose":"20 г на 10 л","method":"root","notes":"Азот снижать"}
  ]',
  diseases = '[
    {"name":"Кила","symptoms":"Вздутия на корнях, растение отстаёт в росте, увядает","conditions":"Кислая почва, заражение","treatment":"Нет лечения; убрать и уничтожить растение","prevention":"Известкование почвы до pH 7, севооборот 5-7 лет"},
    {"name":"Чёрная ножка","symptoms":"Потемнение и перетяжка стебля у основания у рассады","conditions":"Переувлажнение, загущённость","treatment":"Фитолавин, Превикур","prevention":"Прореживание рассады, умеренный полив"},
    {"name":"Пероноспороз","symptoms":"Жёлтые пятна на листьях, серый налёт снизу","conditions":"Влажность, прохлада","treatment":"Ридомил Голд, ХОМ","prevention":"Проветривание, севооборот"}
  ]',
  pests = '[
    {"name":"Капустная белянка","signs":"Жёлтые яйца на листьях, зелёные гусеницы объедают листья","treatment":"Лепидоцид, Битоксибациллин, Децис","prevention":"Накрывать нетканым материалом, бархатцы рядом"},
    {"name":"Крестоцветная блошка","signs":"Мелкие дырочки на листьях молодых растений","treatment":"Актеллик, Карбофос; опыление золой","prevention":"Ранняя высадка, опыление золой и табаком"},
    {"name":"Капустная тля","signs":"Колонии сизо-зелёной тли на листьях, деформация","treatment":"Актеллик, Биотлин","prevention":"Посадки укропа и петрушки рядом"},
    {"name":"Слизни","signs":"Объеденные листья с ходами, ночной вред","treatment":"Метальдегид, зола, песок вокруг","prevention":"Рыхление почвы, устранение укрытий"}
  ]',
  good_neighbors = '{"Картофель","Огурец","Редис","Свёкла","Сельдерей","Чеснок","Укроп","Петрушка","Шпинат"}',
  bad_neighbors  = '{"Морковь","Фасоль","Томат","Лук репчатый","Редька"}',
  good_predecessors = '{"Бобовые","Огурец","Лук","Картофель","Морковь"}'
WHERE name = 'Капуста белокочанная';

-- ---- МОРКОВЬ ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":80,"sow_end":105},
    "5": {"sow_start":91,"sow_end":121},
    "4": {"sow_start":100,"sow_end":130},
    "3": {"sow_start":110,"sow_end":140}
  }',
  watering_details = '{
    "growing":   {"freq_days":5,"amount_l_m2":5},
    "fruiting":  {"freq_days":5,"amount_l_m2":8},
    "notes": "Умеренный полив. Нельзя допускать пересыхания почвы — корнеплод трескается. Поверхностный полив вызывает ветвление. Поливать в борозды, не дождеванием."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"В фазе 2-3 настоящих листьев","fertilizer_type":"NPK","product_example":"Нитрофоска","dose":"20 г на 1 м² (рассыпают и рыхлят)","method":"root","notes":"Азот умеренно"},
    {"stage":"fruiting","timing":"В июле, при активном росте корнеплода","fertilizer_type":"K","product_example":"Сульфат калия","dose":"15 г на 10 л","method":"root","notes":"Улучшает сахаристость, размер"},
    {"stage":"fruiting","timing":"В августе","fertilizer_type":"K","product_example":"Зола","dose":"1 стакан на 1 м² (поверхностно)","method":"root","notes":"Минеральный калий"}
  ]',
  diseases = '[
    {"name":"Фомоз (сухая гниль)","symptoms":"Серовато-коричневые пятна на корнеплодах, белый налёт при хранении","conditions":"Недостаток бора, влажность при хранении","treatment":"Обработка корнеплодов перед хранением","prevention":"Внесение буры 2-4 г/м², правильное хранение"},
    {"name":"Чёрная гниль (альтернариоз)","symptoms":"Чёрные вдавленные пятна на корнеплодах","conditions":"Поражение в поле, распространяется при хранении","treatment":"Нет, профилактика","prevention":"Севооборот, обеззараживание семян, не травмировать при уборке"}
  ]',
  pests = '[
    {"name":"Морковная муха","signs":"Красновато-фиолетовые листья, ходы и гниль в корнеплоде","treatment":"Защитные укрытия (агроволокно), Базудин в почву","prevention":"Посев лука и чеснока рядом — запах отпугивает"},
    {"name":"Морковная листоблошка","signs":"Скручивание листьев, деформация корнеплода","treatment":"Актара, Актеллик","prevention":"Укрывной материал, уничтожение хвойного подлеска рядом"}
  ]',
  good_neighbors = '{"Лук репчатый","Лук-порей","Шалфей","Редис","Горох","Петрушка","Огурец","Розмарин"}',
  bad_neighbors  = '{"Укроп","Фенхель","Капуста белокочанная"}',
  good_predecessors = '{"Картофель","Капуста ранняя","Бобовые","Огурец","Лук","Томат"}'
WHERE name = 'Морковь';

-- ---- СВЁКЛА ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":80,"sow_end":100},
    "5": {"sow_start":95,"sow_end":121},
    "4": {"sow_start":110,"sow_end":135},
    "3": {"sow_start":121,"sow_end":145}
  }',
  watering_details = '{
    "growing":  {"freq_days":6,"amount_l_m2":6},
    "fruiting": {"freq_days":5,"amount_l_m2":8},
    "notes": "Засухоустойчивее моркови, но полив необходим. При засухе корнеплод грубеет. За 3-4 недели до уборки полив сокращают."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"В фазе 3-4 листьев","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"10 г на 10 л","method":"root","notes":""},
    {"stage":"fruiting","timing":"В июле","fertilizer_type":"NPK","product_example":"Нитрофоска","dose":"20 г на 10 л","method":"root","notes":""},
    {"stage":"fruiting","timing":"В августе","fertilizer_type":"K","product_example":"Хлористый калий","dose":"15 г на 10 л","method":"root","notes":"Улучшает лёжкость"}
  ]',
  diseases = '[
    {"name":"Церкоспороз","symptoms":"Округлые бурые пятна с красно-фиолетовым ободком на листьях","conditions":"Влажность, тепло","treatment":"Бордоская смесь, ХОМ","prevention":"Севооборот, не загущать"},
    {"name":"Фомоз","symptoms":"Серые пятна на листьях с чёрными точками, гниль корнеплода","conditions":"Недостаток бора","treatment":"Некорневые подкормки бором","prevention":"Борные удобрения при посеве"}
  ]',
  pests = '[
    {"name":"Свекловичная тля","signs":"Чёрные колонии на нижней стороне листьев, скручивание","treatment":"Актеллик, Биотлин","prevention":"Уничтожение бересклета (промежуточный хозяин)"},
    {"name":"Свекловичная листовая минирующая муха","signs":"Мины-тоннели в листьях, белёсые ходы","treatment":"Актара","prevention":"Рыхление почвы, уничтожение сорняков"}
  ]',
  good_neighbors = '{"Капуста","Лук репчатый","Морковь","Огурец","Кабачок","Чеснок","Салат","Редис"}',
  bad_neighbors  = '{"Картофель","Фасоль","Кукуруза","Лук-порей"}',
  good_predecessors = '{"Огурец","Бобовые","Картофель","Томат","Капуста","Лук"}'
WHERE name = 'Свёкла';

-- ---- ЛУК РЕПЧАТЫЙ ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":74,"sow_end":100},
    "5": {"sow_start":91,"sow_end":121},
    "4": {"sow_start":100,"sow_end":130},
    "3": {"sow_start":110,"sow_end":140}
  }',
  watering_details = '{
    "growing":  {"freq_days":5,"amount_l_m2":5},
    "fruiting": {"freq_days":7,"amount_l_m2":4},
    "notes": "В первую половину вегетации поливать умеренно. За месяц до уборки (середина июля) полив прекратить — луковицы лучше вызревают и хранятся."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"15 г на 10 л","method":"root","notes":"На перо — больше азота"},
    {"stage":"growing","timing":"Через 3 недели после первой","fertilizer_type":"NPK","product_example":"Нитрофоска","dose":"20 г на 10 л","method":"root","notes":""},
    {"stage":"fruiting","timing":"В начале формирования луковицы","fertilizer_type":"PK","product_example":"Суперфосфат + сульфат калия","dose":"15+15 г на 10 л","method":"root","notes":"Азот исключить"}
  ]',
  diseases = '[
    {"name":"Пероноспороз (ложная мучнистая роса)","symptoms":"Серый налёт на листьях, листья желтеют и полегают","conditions":"Влажная прохладная погода","treatment":"Ридомил Голд, Ордан","prevention":"Прогрев посевного материала (45°C 8 часов), широкие грядки"},
    {"name":"Шейковая гниль","symptoms":"Мягкая гниль у шейки луковицы при хранении","conditions":"Уборка при высокой влажности, недосушенный лук","treatment":"Нет, профилактика","prevention":"Дать вызреть, хорошо просушить, хранить сухо"}
  ]',
  pests = '[
    {"name":"Луковая муха","signs":"Увядание и пожелтение пера, личинки в луковице","treatment":"Базудин в почву, Актара","prevention":"Лук рядом с морковью (взаимная защита), мульчирование"},
    {"name":"Луковый скрытнохоботник","signs":"Белые ходы в листьях, пожелтение","treatment":"Актеллик при первых признаках","prevention":"Ранний посев, осенняя перекопка"}
  ]',
  good_neighbors = '{"Морковь","Свёкла","Огурец","Томат","Салат","Чабер","Петрушка","Клубника"}',
  bad_neighbors  = '{"Горох","Фасоль","Редис","Капуста белокочанная","Редька"}',
  good_predecessors = '{"Бобовые","Ранний картофель","Огурец","Капуста"}'
WHERE name = 'Лук репчатый';

-- ---- ЧЕСНОК ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":274,"sow_end":305},
    "5": {"sow_start":265,"sow_end":295},
    "4": {"sow_start":258,"sow_end":283},
    "3": {"sow_start":252,"sow_end":274}
  }',
  watering_details = '{
    "growing":  {"freq_days":5,"amount_l_m2":5},
    "fruiting": {"freq_days":7,"amount_l_m2":4},
    "notes": "Озимый: поливать весной при отрастании. За 3 недели до уборки полив прекратить. Яровой: полив умеренный весь период. Переувлажнение вызывает гниль."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"Ранней весной при отрастании","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"10 г на 10 л","method":"root","notes":"Озимый чеснок — первая подкормка"},
    {"stage":"growing","timing":"В мае, в фазе 5-6 листьев","fertilizer_type":"NPK","product_example":"Нитроаммофоска","dose":"15 г на 10 л","method":"root","notes":""},
    {"stage":"fruiting","timing":"В начале июня","fertilizer_type":"PK","product_example":"Монофосфат калия","dose":"15 г на 10 л","method":"root","notes":"Формирование головки"}
  ]',
  diseases = '[
    {"name":"Фузариоз (гниль донца)","symptoms":"Пожелтение листьев, гниль в основании луковицы, белый налёт","conditions":"Высокая температура, влажная почва","treatment":"Превикур","prevention":"Обеззараживание зубков марганцовкой перед посадкой, севооборот"},
    {"name":"Белая гниль","symptoms":"Белый ватообразный налёт у основания, полегание","conditions":"Прохлада, сырость","treatment":"Нет лечения","prevention":"Дренированная почва, севооборот 4-5 лет"}
  ]',
  pests = '[
    {"name":"Луковая муха","signs":"Пожелтение пера, личинки в основании","treatment":"Базудин в почву, полив солевым раствором (250 г/10 л)","prevention":"Мульчирование, рядом с морковью"},
    {"name":"Стеблевая нематода","signs":"Деформация луковицы, серебристость чешуй","treatment":"Нет эффективного лечения","prevention":"Обеззараживание зубков горячей водой 45°C 15 мин, севооборот"}
  ]',
  good_neighbors = '{"Морковь","Огурец","Томат","Свёкла","Клубника","Петрушка","Салат"}',
  bad_neighbors  = '{"Горох","Фасоль","Капуста","Бобы"}',
  good_predecessors = '{"Огурец","Кабачок","Тыква","Бобовые","Ранние культуры"}'
WHERE name = 'Чеснок';

-- ---- РЕДИС ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":74,"sow_end":260},
    "5": {"sow_start":85,"sow_end":250},
    "4": {"sow_start":95,"sow_end":240},
    "3": {"sow_start":105,"sow_end":230}
  }',
  watering_details = '{
    "growing": {"freq_days":2,"amount_l_m2":5},
    "notes": "Любит влагу. Нерегулярный полив — корнеплод трескается и горчит. Поверхностный полив или дождевание 2 раза в день в жару."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"Редис обычно не подкармливают — цикл 25 дней","fertilizer_type":"NPK","product_example":"Только при видимом голодании","dose":"","method":"root","notes":"Если листья бледные — слабый раствор нитрофоски"}
  ]',
  diseases = '[
    {"name":"Кила","symptoms":"Вздутия на корнях","conditions":"Кислая почва","treatment":"Нет","prevention":"Раскисление почвы"},
    {"name":"Чёрная ножка","symptoms":"Потемнение стебля у основания","conditions":"Переувлажнение рассады","treatment":"Умеренный полив","prevention":"Дренаж"}
  ]',
  pests = '[
    {"name":"Крестоцветная блошка","signs":"Мелкие дырочки на листьях, особенно в сухую погоду","treatment":"Золой опыление, Актеллик","prevention":"Ранний посев (до жары), укрывной материал"},
    {"name":"Капустная муха","signs":"Пожелтение и увядание, личинки в корнеплоде","treatment":"Базудин","prevention":"Ранний посев"}
  ]',
  good_neighbors = '{"Морковь","Томат","Капуста","Салат","Петрушка","Фасоль","Шпинат"}',
  bad_neighbors  = '{"Огурец","Лук репчатый"}',
  good_predecessors = '{"Ранний картофель","Зелень"}'
WHERE name = 'Редис';

-- ---- САЛАТ ЛИСТОВОЙ ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":74,"sow_end":260},
    "5": {"sow_start":85,"sow_end":244},
    "4": {"sow_start":95,"sow_end":235},
    "3": {"sow_start":105,"sow_end":220}
  }',
  watering_details = '{
    "growing": {"freq_days":2,"amount_l_m2":4},
    "notes": "Регулярный умеренный полив. При пересыхании идёт в стрелку. В жару прикрывать. Предпочитает прохладу."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"5 г на 10 л","method":"root","notes":"Слабый раствор — не перекармливать нитратами"}
  ]',
  diseases = '[
    {"name":"Серая гниль","symptoms":"Пушистый серый налёт на листьях","conditions":"Высокая влажность, загущённость","treatment":"Удаление поражённых листьев","prevention":"Прореживание, хорошая вентиляция"}
  ]',
  pests = '[
    {"name":"Тля","signs":"Колонии на листьях, деформация","treatment":"Мыльный раствор, Фитоверм","prevention":"Хищные насекомые, укроп рядом"},
    {"name":"Слизни","signs":"Съеденные края листьев, следы","treatment":"Зола, пиво-ловушки, Гроза","prevention":"Рыхление почвы, убирать укрытия"}
  ]',
  good_neighbors = '{"Редис","Морковь","Огурец","Томат","Клубника","Свёкла","Капуста"}',
  bad_neighbors  = '{}',
  good_predecessors = '{"Огурец","Капуста"}'
WHERE name = 'Салат листовой';

-- ---- КАРТОФЕЛЬ ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":95,"sow_end":115},
    "5": {"sow_start":110,"sow_end":130},
    "4": {"sow_start":121,"sow_end":140},
    "3": {"sow_start":130,"sow_end":148}
  }',
  watering_details = '{
    "growing":   {"freq_days":7,"amount_l_m2":6},
    "flowering": {"freq_days":4,"amount_l_m2":10},
    "fruiting":  {"freq_days":5,"amount_l_m2":8},
    "notes": "Полив в бутонизации и цветении — критически важен. 1 куст = 3-5 литров за раз. После цветения сокращаем. За 2 недели до уборки — прекращаем."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"При высоте ботвы 10-15 см","fertilizer_type":"N","product_example":"Нитроаммофоска","dose":"20 г на 10 л","method":"root","notes":"Совместить с окучиванием"},
    {"stage":"flowering","timing":"В начале бутонизации","fertilizer_type":"PK","product_example":"Суперфосфат + сульфат калия","dose":"20+20 г на 10 л","method":"root","notes":"Закладка клубней"},
    {"stage":"fruiting","timing":"Через 2 недели после цветения","fertilizer_type":"K","product_example":"Сульфат калия","dose":"20 г на 10 л","method":"root","notes":"Налив клубней"}
  ]',
  diseases = '[
    {"name":"Фитофтороз","symptoms":"Бурые пятна на листьях, белый налёт снизу, гниль клубней","conditions":"Влажность >75%, перепад температур","treatment":"Ридомил Голд, Ордан, бордоская смесь","prevention":"Устойчивые сорта, опрыскивание с начала июля"},
    {"name":"Парша обыкновенная","symptoms":"Корковые трещины на клубнях","conditions":"Щелочная почва, сухая погода","treatment":"Нет","prevention":"Кислая реакция почвы, севооборот"},
    {"name":"Чёрная ножка","symptoms":"Почернение стебля у основания, увядание куста","conditions":"Переувлажнение, заражённые клубни","treatment":"Убрать куст","prevention":"Здоровый семенной материал, не переувлажнять"}
  ]',
  pests = '[
    {"name":"Колорадский жук","signs":"Оранжевые яйца под листьями, личинки объедают листья","treatment":"Командор, Актара, Конфидор; биопрепарат Бовергрин","prevention":"Мульчирование соломой, ручной сбор, посадка хрена по периметру"},
    {"name":"Проволочник","signs":"Ходы в клубнях","treatment":"Базудин в лунку, Провотокс","prevention":"Осенняя перекопка, горчица-сидерат"}
  ]',
  good_neighbors = '{"Фасоль","Бобы","Капуста","Лук","Редис","Хрен","Чеснок","Кукуруза","Бархатцы"}',
  bad_neighbors  = '{"Томат","Огурец","Тыква","Фенхель","Щавель"}',
  good_predecessors = '{"Бобовые","Корнеплоды","Тыквенные","Лук","Огурец"}'
WHERE name = 'Картофель';

-- ---- УКРОП ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":60,"sow_end":244},
    "5": {"sow_start":74,"sow_end":235},
    "4": {"sow_start":85,"sow_end":225},
    "3": {"sow_start":95,"sow_end":213}
  }',
  watering_details = '{"growing":{"freq_days":3,"amount_l_m2":4},"notes":"Умеренный полив. При засухе быстро идёт в стрелку."}',
  fertilizing_schedule = '[]',
  diseases = '[{"name":"Мучнистая роса","symptoms":"Белый налёт на зонтиках","conditions":"Жара и влажность","treatment":"Коллоидная сера","prevention":"Прореживание"}]',
  pests = '[{"name":"Тля зонтичная","signs":"Колонии под зонтиком","treatment":"Мыльный раствор","prevention":""}]',
  good_neighbors = '{"Огурец","Капуста","Лук","Морковь","Фасоль"}',
  bad_neighbors  = '{"Томат","Перец","Фенхель","Морковь (не рядом плотно)"}',
  good_predecessors = '{}'
WHERE name = 'Укроп';

-- ---- ПЕТРУШКА ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":60,"sow_end":244},
    "5": {"sow_start":74,"sow_end":235},
    "4": {"sow_start":85,"sow_end":225},
    "3": {"sow_start":95,"sow_end":213}
  }',
  watering_details = '{"growing":{"freq_days":4,"amount_l_m2":4},"notes":"Умеренный полив, засухоустойчивее укропа."}',
  fertilizing_schedule = '[{"stage":"growing","timing":"Весной, при отрастании","fertilizer_type":"N","product_example":"Мочевина","dose":"10 г на 10 л","method":"root","notes":""}]',
  diseases = '[{"name":"Септориоз","symptoms":"Светлые пятна с тёмным ободком на листьях","conditions":"Влажность","treatment":"ХОМ","prevention":"Севооборот"}]',
  pests = '[{"name":"Морковная муха","signs":"Пожелтение листьев, ходы в черешках","treatment":"Актара","prevention":"Рядом с луком"}]',
  good_neighbors = '{"Томат","Огурец","Лук","Спаржа","Базилик","Фасоль"}',
  bad_neighbors  = '{"Салат кочанный"}',
  good_predecessors = '{}'
WHERE name = 'Петрушка';

-- ---- БАЗИЛИК ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":100,"sow_end":130,"transplant_start":121,"transplant_end":152},
    "5": {"sow_start":121,"sow_end":145,"transplant_start":140,"transplant_end":163},
    "4": {"sow_start":130,"sow_end":152,"transplant_start":152,"transplant_end":172},
    "3": {"sow_start":140,"sow_end":160,"transplant_start":163,"transplant_end":182}
  }',
  watering_details = '{"growing":{"freq_days":2,"amount_l_m2":3},"notes":"Регулярный умеренный полив. Не любит холодную воду и переувлажнение."}',
  fertilizing_schedule = '[{"stage":"growing","timing":"Через 3 недели после высадки","fertilizer_type":"N","product_example":"Мочевина","dose":"5 г на 10 л","method":"root","notes":"Слабая подкормка"}]',
  diseases = '[{"name":"Фузариоз","symptoms":"Потемнение стебля, увядание","conditions":"Заражённая почва","treatment":"Превикур","prevention":"Здоровый грунт, дренаж"}]',
  pests = '[{"name":"Тля","signs":"Колонии на молодых листьях","treatment":"Мыльный раствор","prevention":""}]',
  good_neighbors = '{"Томат","Перец","Спаржа","Петрушка"}',
  bad_neighbors  = '{"Огурец","Шалфей","Тимьян"}',
  good_predecessors = '{}'
WHERE name = 'Базилик';

-- ---- КИНЗА ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":60,"sow_end":213},
    "5": {"sow_start":74,"sow_end":200},
    "4": {"sow_start":85,"sow_end":190},
    "3": {"sow_start":95,"sow_end":182}
  }',
  watering_details = '{"growing":{"freq_days":4,"amount_l_m2":4},"notes":"Засухоустойчива. При жаре быстро идёт в стрелку."}',
  fertilizing_schedule = '[]',
  diseases = '[]',
  pests = '[{"name":"Зонтичная тля","signs":"Колонии на стеблях и зонтиках","treatment":"Мыльный раствор","prevention":""}]',
  good_neighbors = '{"Шпинат","Салат","Укроп"}',
  bad_neighbors  = '{}',
  good_predecessors = '{}'
WHERE name = 'Кинза';

-- ---- КЛУБНИКА ----
UPDATE crops SET
  climate_zones = '{
    "6": {"transplant_start":60,"transplant_end":91},
    "5": {"transplant_start":74,"transplant_end":105},
    "4": {"transplant_start":85,"transplant_end":115},
    "3": {"transplant_start":91,"transplant_end":121}
  }',
  watering_details = '{
    "growing":  {"freq_days":5,"amount_l_m2":5},
    "flowering":{"freq_days":4,"amount_l_m2":6},
    "fruiting": {"freq_days":3,"amount_l_m2":8},
    "notes": "Капельный полив предпочтителен. Дождевание провоцирует серую гниль. В период цветения нельзя поливать сверху."
  }',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"Ранней весной при отрастании","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"10 г на 10 л","method":"root","notes":""},
    {"stage":"flowering","timing":"В начале цветения","fertilizer_type":"PK","product_example":"Монофосфат калия","dose":"15 г на 10 л","method":"root","notes":""},
    {"stage":"fruiting","timing":"После плодоношения","fertilizer_type":"NPK","product_example":"Кемира Осень","dose":"20 г на 10 л","method":"root","notes":"Закладка плодовых почек следующего года"}
  ]',
  diseases = '[
    {"name":"Серая гниль (Botrytis)","symptoms":"Серый пушистый налёт на ягодах","conditions":"Дождливая погода, загущённые посадки","treatment":"Свитч, Тиовит Джет","prevention":"Мульчирование соломой/агроволокном, дождевание исключить"},
    {"name":"Мучнистая роса","symptoms":"Белый налёт на листьях, ягоды уродливые","conditions":"Жара и влажность","treatment":"Топаз, коллоидная сера","prevention":"Не загущать"}
  ]',
  pests = '[
    {"name":"Земляничный клещ","signs":"Мелкие деформированные листья, жёлтый налёт","treatment":"Карбофос, Фитоверм","prevention":"Обработка кустов горячей водой 65°C после плодоношения"},
    {"name":"Долгоносик земляничный","signs":"Надкушенные цветоносы, дырки в ягодах","treatment":"Актеллик, Карбофос до цветения","prevention":"Рыхление почвы, осенняя перекопка"}
  ]',
  good_neighbors = '{"Чеснок","Лук","Петрушка","Шпинат","Бобы","Огурец"}',
  bad_neighbors  = '{"Капуста","Картофель","Томат"}',
  good_predecessors = '{"Бобовые","Злаки","Лук","Чеснок"}'
WHERE name = 'Клубника';

-- ---- МАЛИНА ----
UPDATE crops SET
  climate_zones = '{
    "6": {"transplant_start":74,"transplant_end":105},
    "5": {"transplant_start":85,"transplant_end":115},
    "4": {"transplant_start":95,"transplant_end":121},
    "3": {"transplant_start":100,"transplant_end":130}
  }',
  watering_details = '{"growing":{"freq_days":7,"amount_l_m2":8},"fruiting":{"freq_days":5,"amount_l_m2":10},"notes":"Полив у корня. В период созревания ягод — регулярный. Мульчирование обязательно."}',
  fertilizing_schedule = '[
    {"stage":"growing","timing":"Ранней весной","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"15 г на 1 м² (рассыпать)","method":"root","notes":""},
    {"stage":"fruiting","timing":"После плодоношения","fertilizer_type":"PK","product_example":"Суперфосфат+сульфат калия","dose":"По 20 г на 1 м²","method":"root","notes":"Закладка урожая следующего года"}
  ]',
  diseases = '[
    {"name":"Антракноз","symptoms":"Серые пятна с пурпурным ободком на побегах и листьях","conditions":"Влажность","treatment":"Ридомил, бордоская смесь","prevention":"Прореживание, удаление больных побегов"},
    {"name":"Дидимелла (пурпуровая пятнистость)","symptoms":"Пурпурные пятна у основания побегов","conditions":"Загущённые посадки","treatment":"ХОМ, бордоская смесь","prevention":"Нормировка побегов"}
  ]',
  pests = '[
    {"name":"Малинный жук","signs":"Личинки в ягодах","treatment":"Актеллик, Карбофос до цветения","prevention":"Рыхление почвы под кустами"},
    {"name":"Малинно-земляничный долгоносик","signs":"Опавшие бутоны","treatment":"Актеллик до цветения","prevention":"Осенняя уборка растительных остатков"}
  ]',
  good_neighbors = '{"Чеснок","Лук","Петрушка","Бархатцы","Тысячелистник"}',
  bad_neighbors  = '{"Томат","Картофель","Клубника (на одной грядке)"}',
  good_predecessors = '{"Бобовые","Злаки"}'
WHERE name = 'Малина';

-- ---- БАРХАТЦЫ ----
UPDATE crops SET
  climate_zones = '{
    "6": {"sow_start":60,"sow_end":80,"transplant_start":100,"transplant_end":121},
    "5": {"sow_start":74,"sow_end":95,"transplant_start":121,"transplant_end":140},
    "4": {"sow_start":85,"sow_end":105,"transplant_start":135,"transplant_end":152},
    "3": {"sow_start":95,"sow_end":115,"transplant_start":148,"transplant_end":165}
  }',
  watering_details = '{"growing":{"freq_days":3,"amount_l_m2":3},"notes":"Умеренный полив. Засухоустойчивы. Переувлажнение вызывает загнивание."}',
  fertilizing_schedule = '[{"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"NPK","product_example":"Нитрофоска","dose":"10 г на 10 л","method":"root","notes":""}]',
  diseases = '[{"name":"Серая гниль","symptoms":"Серый налёт на цветах в дождливую погоду","conditions":"Высокая влажность","treatment":"Фундазол","prevention":"Дренаж, не загущать"}]',
  pests = '[{"name":"Тля","signs":"Колонии на побегах","treatment":"Мыльный раствор","prevention":"Привлечение хищников"}]',
  good_neighbors = '{"Все овощные культуры","Картофель","Томат","Клубника","Розы"}',
  bad_neighbors  = '{}',
  good_predecessors = '{}'
WHERE name = 'Бархатцы';

-- Петуния — обновляем минимально
UPDATE crops SET
  good_neighbors = '{"Все цветочные культуры"}',
  bad_neighbors  = '{}',
  good_predecessors = '{}'
WHERE name = 'Петуния';


-- ============================================================
-- ЧАСТЬ 2: НОВЫЕ КУЛЬТУРЫ
-- ============================================================

INSERT INTO crops (name, category, sowing_start_day, sowing_end_day, transplant_days, harvest_days, watering_freq_days, frost_sensitive, notes, climate_zones, watering_details, fertilizing_schedule, diseases, pests, good_neighbors, bad_neighbors, good_predecessors) VALUES

-- ---- ТЫКВА ----
('Тыква', 'vegetable', 130, 155, NULL, 100, 4, true,
'Неприхотливая, мощная лиана. Требует много места. Хорошо растёт на компостных кучах.',
'{
  "6": {"sow_start":105,"sow_end":125},
  "5": {"sow_start":121,"sow_end":140},
  "4": {"sow_start":130,"sow_end":148},
  "3": {"sow_start":140,"sow_end":158}
}',
'{"growing":{"freq_days":5,"amount_l_m2":10},"fruiting":{"freq_days":4,"amount_l_m2":15},"notes":"Обильный полив под корень. Не смачивать плети и листья."}',
'[
  {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Мочевина","dose":"15 г на 10 л","method":"root","notes":""},
  {"stage":"flowering","timing":"В начале цветения","fertilizer_type":"NPK","product_example":"Нитрофоска","dose":"20 г на 10 л","method":"root","notes":""},
  {"stage":"fruiting","timing":"При завязывании плодов","fertilizer_type":"K","product_example":"Сульфат калия","dose":"20 г на 10 л","method":"root","notes":""}
]',
'[{"name":"Мучнистая роса","symptoms":"Белый налёт на листьях","conditions":"Жара + влажность","treatment":"Коллоидная сера, Топаз","prevention":"Прореживание плетей"}]',
'[{"name":"Бахчевая тля","signs":"Колонии на нижней стороне листьев","treatment":"Актара, мыльный раствор","prevention":"Бархатцы рядом"}]',
'{"Кукуруза","Фасоль","Укроп"}',
'{"Картофель","Дыня"}',
'{"Многолетние травы","Картофель","Капуста","Бобовые"}'),

-- ---- ПАТИССОН ----
('Патиссон', 'vegetable', 130, 155, NULL, 50, 3, true,
'Близкий родственник кабачка. Красивые плоды в форме тарелки.',
'{
  "6": {"sow_start":105,"sow_end":125},
  "5": {"sow_start":121,"sow_end":140},
  "4": {"sow_start":130,"sow_end":148},
  "3": {"sow_start":140,"sow_end":158}
}',
'{"growing":{"freq_days":4,"amount_l_m2":8},"fruiting":{"freq_days":3,"amount_l_m2":10},"notes":"Полив под корень. Регулярный сбор плодов увеличивает плодоношение."}',
'[
  {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Мочевина","dose":"10 г на 10 л","method":"root","notes":""},
  {"stage":"fruiting","timing":"Каждые 2 недели","fertilizer_type":"K","product_example":"Сульфат калия","dose":"15 г на 10 л","method":"root","notes":""}
]',
'[{"name":"Мучнистая роса","symptoms":"Белый налёт на листьях","conditions":"Жара","treatment":"Коллоидная сера","prevention":"Проветривание"}]',
'[{"name":"Тля","signs":"Колонии под листьями","treatment":"Актара","prevention":"Бархатцы рядом"}]',
'{"Лук","Морковь","Томат","Укроп"}',
'{}',
'{"Картофель","Капуста","Лук","Бобовые"}'),

-- ---- КАПУСТА ЦВЕТНАЯ ----
('Капуста цветная', 'vegetable', 75, 110, 45, 80, 3, false,
'Требовательна к плодородию и влаге. Головки беречь от солнца — связывать листья.',
'{
  "6": {"sow_start":60,"sow_end":91,"transplant_start":91,"transplant_end":121},
  "5": {"sow_start":74,"sow_end":100,"transplant_start":110,"transplant_end":135},
  "4": {"sow_start":85,"sow_end":110,"transplant_start":121,"transplant_end":145},
  "3": {"sow_start":95,"sow_end":115,"transplant_start":135,"transplant_end":155}
}',
'{"growing":{"freq_days":3,"amount_l_m2":8},"fruiting":{"freq_days":2,"amount_l_m2":12},"notes":"Влаголюбива, не переносит засухи. Мульчирование обязательно."}',
'[
  {"stage":"seedling","timing":"В фазе 3-4 листьев","fertilizer_type":"NPK","product_example":"Кемира","dose":"15 г на 10 л","method":"root","notes":""},
  {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"15 г на 10 л","method":"root","notes":""},
  {"stage":"fruiting","timing":"При начале формирования головки","fertilizer_type":"PK","product_example":"Нитрофоска без хлора","dose":"20 г на 10 л","method":"root","notes":"+ внесение бора (2 г/10 л)"}
]',
'[{"name":"Кила","symptoms":"Вздутия на корнях","conditions":"Кислая почва","treatment":"Нет","prevention":"Известкование"},{"name":"Пероноспороз","symptoms":"Жёлтые пятна, серый налёт снизу","conditions":"Влажность","treatment":"Ридомил Голд","prevention":"Проветривание"}]',
'[{"name":"Капустная белянка","signs":"Гусеницы объедают листья","treatment":"Лепидоцид, Битоксибациллин","prevention":"Укрывной материал"},{"name":"Крестоцветная блошка","signs":"Мелкие дырки на листьях","treatment":"Зола, Актеллик","prevention":"Ранняя высадка"}]',
'{"Картофель","Огурец","Сельдерей","Салат","Лук-порей"}',
'{"Томат","Клубника"}',
'{"Бобовые","Огурец","Ранние овощи"}'),

-- ---- КАПУСТА БРОККОЛИ ----
('Капуста брокколи', 'vegetable', 75, 110, 45, 80, 3, false,
'Холодостойка. Срезать головку до рассыпания — стимулирует рост боковых побегов.',
'{
  "6": {"sow_start":60,"sow_end":91,"transplant_start":91,"transplant_end":121},
  "5": {"sow_start":74,"sow_end":100,"transplant_start":110,"transplant_end":135},
  "4": {"sow_start":85,"sow_end":110,"transplant_start":121,"transplant_end":145},
  "3": {"sow_start":95,"sow_end":115,"transplant_start":135,"transplant_end":155}
}',
'{"growing":{"freq_days":3,"amount_l_m2":8},"fruiting":{"freq_days":2,"amount_l_m2":10},"notes":"Хорошо переносит заморозки до -5°C. Оптимальная температура 16-20°C."}',
'[
  {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"15 г на 10 л","method":"root","notes":""},
  {"stage":"fruiting","timing":"При начале формирования головки","fertilizer_type":"PK","product_example":"Нитрофоска","dose":"20 г на 10 л","method":"root","notes":"+ бор (2 г/10 л)"}
]',
'[{"name":"Кила","symptoms":"Вздутия корней","conditions":"Кислая почва","treatment":"Нет","prevention":"Известкование pH>7"},{"name":"Чёрная ножка","symptoms":"Потемнение стебля","conditions":"Переувлажнение","treatment":"Умеренный полив","prevention":"Дренаж"}]',
'[{"name":"Капустная белянка","signs":"Гусеницы","treatment":"Лепидоцид","prevention":"Укрывной материал"},{"name":"Тля","signs":"Колонии","treatment":"Актеллик","prevention":""}]',
'{"Картофель","Лук","Морковь","Петрушка","Сельдерей","Свёкла","Шалфей"}',
'{"Томат","Фасоль"}',
'{"Бобовые","Огурец","Картофель"}'),

-- ---- КАПУСТА ПЕКИНСКАЯ ----
('Капуста пекинская', 'vegetable', 60, 100, 25, 50, 2, false,
'Быстрорастущая. Склонна к стрелкованию при длинном дне. Лучшие сроки: весна и август.',
'{
  "6": {"sow_start":60,"sow_end":80},
  "5": {"sow_start":74,"sow_end":91},
  "4": {"sow_start":80,"sow_end":100},
  "3": {"sow_start":91,"sow_end":110}
}',
'{"growing":{"freq_days":2,"amount_l_m2":6},"notes":"Регулярный полив. Нельзя допускать пересыхания — уходит в стрелку."}',
'[{"stage":"growing","timing":"Через 10 дней после появления всходов","fertilizer_type":"N","product_example":"Мочевина","dose":"10 г на 10 л","method":"root","notes":""}]',
'[{"name":"Слизистый бактериоз","symptoms":"Слизистые загнивающие листья с запахом","conditions":"Жара + полив по листьям","treatment":"Удалить повреждённые листья, Фитолавин","prevention":"Полив только под корень"}]',
'[{"name":"Крестоцветная блошка","signs":"Дырки на листьях","treatment":"Зола, Актеллик","prevention":"Укрывной материал"}]',
'{"Морковь","Лук","Огурец","Редис"}',
'{}',
'{"Огурец","Зелень"}'),

-- ---- РЕДЬКА ----
('Редька', 'vegetable', 90, 240, NULL, 60, 4, false,
'Озимую редьку (чёрную) сеют в июне-июле, убирают в октябре. Летние сорта — весенний посев.',
'{
  "6": {"sow_start":80,"sow_end":213},
  "5": {"sow_start":91,"sow_end":200},
  "4": {"sow_start":100,"sow_end":190},
  "3": {"sow_start":110,"sow_end":182}
}',
'{"growing":{"freq_days":4,"amount_l_m2":6},"notes":"Равномерный полив. Нерегулярный — корнеплод трескается и горчит."}',
'[{"stage":"growing","timing":"В фазе 3-4 листьев","fertilizer_type":"NPK","product_example":"Нитроаммофоска","dose":"15 г на 10 л","method":"root","notes":""}]',
'[{"name":"Кила","symptoms":"Вздутия на корнях","conditions":"Кислая почва","treatment":"Нет","prevention":"Известкование"}]',
'[{"name":"Крестоцветная блошка","signs":"Дырки на листьях","treatment":"Зола, Актеллик","prevention":"Ранний или поздний посев"}]',
'{"Морковь","Огурец","Томат","Капуста","Свёкла","Шпинат","Фасоль"}',
'{"Лук репчатый"}',
'{"Бобовые","Огурец","Томат","Ранний картофель"}'),

-- ---- РЕПА ----
('Репа', 'vegetable', 80, 240, NULL, 60, 4, false,
'Скороспелая холодостойкая культура. Два срока посева: ранней весной и в июле.',
'{
  "6": {"sow_start":70,"sow_end":213},
  "5": {"sow_start":80,"sow_end":200},
  "4": {"sow_start":91,"sow_end":190},
  "3": {"sow_start":100,"sow_end":182}
}',
'{"growing":{"freq_days":4,"amount_l_m2":6},"notes":"Равномерный полив. При жаре горчит — сеять на прохладный период."}',
'[{"stage":"growing","timing":"В фазе 3-4 листьев","fertilizer_type":"NPK","product_example":"Нитроаммофоска","dose":"10 г на 10 л","method":"root","notes":""}]',
'[{"name":"Кила","symptoms":"Вздутия корней","conditions":"Кислая почва","treatment":"Нет","prevention":"pH>7"}]',
'[{"name":"Крестоцветная блошка","signs":"Дырки на листьях","treatment":"Зола","prevention":"Укрывной материал"}]',
'{"Редис"}',
'{}',
'{"Огурец","Кабачок","Томат","Бобовые","Картофель"}'),

-- ---- ЛУК-ПОРЕЙ ----
('Лук-порей', 'vegetable', 45, 75, 75, 170, 5, false,
'Длинный вегетационный период, требует рассады. Выбеливают ножку — окучивают.',
'{
  "6": {"sow_start":32,"sow_end":60,"transplant_start":91,"transplant_end":121},
  "5": {"sow_start":46,"sow_end":74,"transplant_start":110,"transplant_end":135},
  "4": {"sow_start":60,"sow_end":80,"transplant_start":121,"transplant_end":145},
  "3": {"sow_start":70,"sow_end":90,"transplant_start":135,"transplant_end":152}
}',
'{"growing":{"freq_days":5,"amount_l_m2":6},"notes":"Умеренный полив. Засухоустойчивее репчатого лука."}',
'[
  {"stage":"growing","timing":"Через 3 недели после высадки","fertilizer_type":"NPK","product_example":"Кемира","dose":"20 г на 10 л","method":"root","notes":""},
  {"stage":"fruiting","timing":"В августе","fertilizer_type":"K","product_example":"Сульфат калия","dose":"15 г на 10 л","method":"root","notes":""}
]',
'[{"name":"Пероноспороз","symptoms":"Серый налёт на листьях","conditions":"Влажность","treatment":"Ридомил Голд","prevention":"Проветривание"}]',
'[{"name":"Луковая муха","signs":"Увядание пера","treatment":"Базудин","prevention":"Рядом с морковью"}]',
'{"Морковь","Сельдерей","Лук репчатый","Свёкла"}',
'{}',
'{"Тыквенные","Паслёновые"}'),

-- ---- ЛУК-БАТУН ----
('Лук-батун', 'vegetable', 60, 244, NULL, 50, 4, false,
'Многолетник. Сеять можно всё лето. Срезать зелень, не вырывая.',
'{
  "6": {"sow_start":50,"sow_end":240},
  "5": {"sow_start":60,"sow_end":230},
  "4": {"sow_start":74,"sow_end":220},
  "3": {"sow_start":85,"sow_end":210}
}',
'{"growing":{"freq_days":5,"amount_l_m2":5},"notes":"Поливать регулярно. Мульчирование удерживает влагу."}',
'[{"stage":"growing","timing":"Ранней весной при отрастании","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"10 г на 10 л","method":"root","notes":""}]',
'[]',
'[{"name":"Луковая муха","signs":"Пожелтение пера","treatment":"Базудин","prevention":"Рядом с морковью"}]',
'{"Морковь","Свёкла","Салат"}',
'{"Горох","Фасоль"}',
'{}'),

-- ---- ШПИНАТ ----
('Шпинат', 'vegetable', 74, 240, NULL, 35, 2, false,
'Холодостойкий скороспелый листовой овощ. Идёт в стрелку при жаре и длинном дне.',
'{
  "6": {"sow_start":60,"sow_end":244},
  "5": {"sow_start":74,"sow_end":235},
  "4": {"sow_start":85,"sow_end":225},
  "3": {"sow_start":91,"sow_end":213}
}',
'{"growing":{"freq_days":2,"amount_l_m2":5},"notes":"Регулярный полив. При засухе горчит и стрелкует. Любит прохладу."}',
'[{"stage":"growing","timing":"Через 2 недели после всходов","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"5 г на 10 л","method":"root","notes":"Слабый раствор"}]',
'[{"name":"Пероноспороз","symptoms":"Жёлтые пятна, серо-фиолетовый налёт снизу","conditions":"Влажность","treatment":"Ридомил","prevention":"Прореживание"}]',
'[{"name":"Тля","signs":"Колонии на листьях","treatment":"Мыльный раствор","prevention":""}]',
'{"Редис","Морковь","Томат","Горох","Капуста","Огурец","Клубника"}',
'{}',
'{}'),

-- ---- ЩАВЕЛЬ ----
('Щавель', 'vegetable', 60, 200, NULL, 60, 4, false,
'Многолетник. Срезают несколько раз за сезон. Выносит кислые почвы.',
'{
  "6": {"sow_start":50,"sow_end":213},
  "5": {"sow_start":60,"sow_end":200},
  "4": {"sow_start":74,"sow_end":190},
  "3": {"sow_start":85,"sow_end":182}
}',
'{"growing":{"freq_days":5,"amount_l_m2":6},"notes":"Любит влагу. При засухе листья грубеют и кислят сильнее."}',
'[{"stage":"growing","timing":"Ранней весной","fertilizer_type":"N","product_example":"Мочевина","dose":"10 г на 10 л","method":"root","notes":"После каждой срезки"}]',
'[{"name":"Ложная мучнистая роса","symptoms":"Жёлтые пятна, налёт","conditions":"Влажность","treatment":"Ридомил","prevention":"Прореживание"}]',
'[{"name":"Щавелевый листоед","signs":"Дырки в листьях","treatment":"Актеллик","prevention":""}]',
'{}',
'{"Картофель","Томат"}',
'{}'),

-- ---- ГОРОХ ----
('Горох', 'vegetable', 80, 130, NULL, 70, 4, false,
'Холодостойкий азотфиксатор. Отличный предшественник для любой культуры.',
'{
  "6": {"sow_start":60,"sow_end":121},
  "5": {"sow_start":74,"sow_end":130},
  "4": {"sow_start":85,"sow_end":140},
  "3": {"sow_start":91,"sow_end":148}
}',
'{"growing":{"freq_days":4,"amount_l_m2":6},"flowering":{"freq_days":3,"amount_l_m2":8},"notes":"Регулярный полив особенно важен в цветении и образовании бобов."}',
'[
  {"stage":"growing","timing":"В фазе 5-6 листьев","fertilizer_type":"PK","product_example":"Суперфосфат","dose":"10 г на 10 л","method":"root","notes":"Азот не нужен — горох фиксирует сам"}
]',
'[{"name":"Мучнистая роса","symptoms":"Белый налёт на листьях и бобах","conditions":"Жара + сухость","treatment":"Коллоидная сера, Топаз","prevention":"Ранний посев, устойчивые сорта"},{"name":"Аскохитоз","symptoms":"Бурые пятна с чёрными точками на листьях и бобах","conditions":"Влажность","treatment":"ХОМ","prevention":"Севооборот"}]',
'[{"name":"Гороховая тля","signs":"Колонии на молодых побегах","treatment":"Актеллик, мыльный раствор","prevention":""},{"name":"Гороховая плодожорка","signs":"Личинки в горошинах","treatment":"Актеллик до цветения","prevention":"Ранний посев"}]',
'{"Морковь","Кукуруза","Капуста","Картофель","Салат","Пряные травы"}',
'{"Лук","Чеснок","Томат","Фасоль","Цуккини"}',
'{"Тыквенные","Корнеплодные","Картофель"}'),

-- ---- ФАСОЛЬ СТРУЧКОВАЯ ----
('Фасоль стручковая', 'vegetable', 120, 155, NULL, 60, 3, true,
'Теплолюбивая. Фиксирует азот. Кустовая — для малых участков, вьющаяся — на шпалере.',
'{
  "6": {"sow_start":100,"sow_end":140},
  "5": {"sow_start":121,"sow_end":155},
  "4": {"sow_start":130,"sow_end":163},
  "3": {"sow_start":140,"sow_end":172}
}',
'{"growing":{"freq_days":4,"amount_l_m2":5},"flowering":{"freq_days":3,"amount_l_m2":7},"notes":"Полив умеренный. Не опрыскивать в цветении — опадают цветки."}',
'[{"stage":"growing","timing":"В фазе 3-4 листьев","fertilizer_type":"PK","product_example":"Нитрофоска","dose":"15 г на 10 л","method":"root","notes":"Азот минимален — фиксирует сама"}]',
'[{"name":"Антракноз","symptoms":"Тёмные пятна на листьях и бобах, язвы","conditions":"Дождливая погода","treatment":"ХОМ, бордоская смесь","prevention":"Здоровые семена, севооборот"}]',
'[{"name":"Паутинный клещ","signs":"Паутина, обесцвечивание листьев","treatment":"Фитоверм","prevention":"Полив по листьям в сухую погоду"},{"name":"Тля","signs":"Колонии на побегах","treatment":"Актеллик","prevention":""}]',
'{"Морковь","Капуста","Кукуруза","Огурец","Картофель","Редис","Свёкла"}',
'{"Лук","Чеснок","Фенхель","Тыква"}',
'{"Тыквенные","Капустные","Корнеплодные","Картофель"}'),

-- ---- КУКУРУЗА ----
('Кукуруза', 'vegetable', 120, 150, NULL, 90, 4, true,
'Ветроопыляемая. Сажать блоками, не рядами. Отличная опора для вьющейся фасоли.',
'{
  "6": {"sow_start":100,"sow_end":125},
  "5": {"sow_start":121,"sow_end":140},
  "4": {"sow_start":130,"sow_end":148},
  "3": {"sow_start":140,"sow_end":158}
}',
'{"growing":{"freq_days":5,"amount_l_m2":6},"flowering":{"freq_days":3,"amount_l_m2":10},"notes":"Обильный полив в период выметания метёлки и налива початков."}',
'[
  {"stage":"growing","timing":"Высота 20-30 см","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"15 г на 10 л","method":"root","notes":""},
  {"stage":"flowering","timing":"Начало выметания метёлки","fertilizer_type":"NPK","product_example":"Нитроаммофоска","dose":"20 г на 10 л","method":"root","notes":""}
]',
'[{"name":"Пузырчатая головня","symptoms":"Белые вздутия на початках и листьях","conditions":"Сухой жаркий период","treatment":"Нет","prevention":"Устойчивые сорта, севооборот"}]',
'[{"name":"Кукурузный мотылёк","signs":"Ходы в стеблях и початках","treatment":"Лепидоцид","prevention":"Раннее уничтожение растительных остатков"},{"name":"Проволочник","signs":"Ходы в зёрнах","treatment":"Базудин","prevention":"Перекопка"}]',
'{"Горох","Огурец","Тыква","Фасоль","Кабачок","Капуста"}',
'{"Свёкла","Сельдерей"}',
'{"Бобовые","Ранние овощи","Лук","Огурец"}'),

-- ---- СЕЛЬДЕРЕЙ ----
('Сельдерей', 'vegetable', 46, 70, 60, 170, 3, false,
'Требовательная, ароматная культура. Черешковый, корневой, листовой — разные агротехники.',
'{
  "6": {"sow_start":32,"sow_end":60,"transplant_start":91,"transplant_end":115},
  "5": {"sow_start":46,"sow_end":70,"transplant_start":110,"transplant_end":135},
  "4": {"sow_start":60,"sow_end":80,"transplant_start":121,"transplant_end":145},
  "3": {"sow_start":70,"sow_end":90,"transplant_start":135,"transplant_end":152}
}',
'{"growing":{"freq_days":3,"amount_l_m2":7},"notes":"Влаголюбив. Не допускать пересыхания — стебли грубеют."}',
'[
  {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"NPK","product_example":"Нитрофоска","dose":"15 г на 10 л","method":"root","notes":""},
  {"stage":"fruiting","timing":"Начало августа","fertilizer_type":"K","product_example":"Сульфат калия","dose":"15 г на 10 л","method":"root","notes":"Для корневого — вызревание корнеплода"}
]',
'[{"name":"Септориоз","symptoms":"Светлые пятна с тёмным ободком на листьях","conditions":"Влажность","treatment":"Бордоская смесь","prevention":"Севооборот"}]',
'[{"name":"Морковная муха","signs":"Ходы в черешках и корнях","treatment":"Актара","prevention":"Совместная посадка с луком"}]',
'{"Капуста","Лук-порей","Томат","Огурец","Шпинат"}',
'{"Картофель","Кукуруза","Салат кочанный"}',
'{"Капустные","Тыквенные","Паслёновые"}'),

-- ---- МЯТА ----
('Мята', 'herb', 60, 200, 30, 60, 3, false,
'Многолетник. Быстро разрастается — сажать в ограниченное пространство или в контейнер.',
'{
  "6": {"sow_start":50,"sow_end":200},
  "5": {"sow_start":60,"sow_end":190},
  "4": {"sow_start":74,"sow_end":182},
  "3": {"sow_start":85,"sow_end":172}
}',
'{"growing":{"freq_days":3,"amount_l_m2":4},"notes":"Любит влагу. Не переносит засуху."}',
'[{"stage":"growing","timing":"Весной при отрастании","fertilizer_type":"N","product_example":"Мочевина","dose":"5 г на 10 л","method":"root","notes":"Слабый раствор"}]',
'[{"name":"Ржавчина","symptoms":"Оранжевые пятна на листьях","conditions":"Влажность","treatment":"Медьсодержащие препараты","prevention":"Хорошая вентиляция"}]',
'[{"name":"Паутинный клещ","signs":"Паутина на листьях","treatment":"Фитоверм","prevention":"Полив листьев"}]',
'{"Капуста","Томат","Горох","Клубника"}',
'{}',
'{}'),

-- ---- ТИМЬЯН (ЧАБРЕЦ) ----
('Тимьян', 'herb', 60, 100, 45, 90, 6, false,
'Засухоустойчивый многолетник. Отпугивает многих вредителей. Хорош как бордюр.',
'{
  "6": {"sow_start":50,"sow_end":121},
  "5": {"sow_start":60,"sow_end":130},
  "4": {"sow_start":74,"sow_end":140},
  "3": {"sow_start":85,"sow_end":148}
}',
'{"growing":{"freq_days":7,"amount_l_m2":3},"notes":"Засухоустойчив. Переувлажнение губительно — нужен хороший дренаж."}',
'[]',
'[]',
'[{"name":"Корневая гниль","signs":"Увядание и гниль корней","treatment":"Нет","prevention":"Дренаж, не переувлажнять"}]',
'{"Капуста","Баклажан","Томат","Картофель"}',
'{"Огурец"}',
'{}'),

-- ---- СМОРОДИНА ЧЁРНАЯ ----
('Смородина чёрная', 'berry', NULL, NULL, NULL, NULL, 7, false,
'Ценная ягода. Кисты высаживают осенью или ранней весной. Плодоносит 15-20 лет.',
'{
  "6": {"transplant_start":60,"transplant_end":91},
  "5": {"transplant_start":74,"transplant_end":105},
  "4": {"transplant_start":85,"transplant_end":115},
  "3": {"transplant_start":91,"transplant_end":125}
}',
'{"growing":{"freq_days":10,"amount_l_m2":8},"fruiting":{"freq_days":5,"amount_l_m2":10},"notes":"Регулярный полив в период налива ягод критичен. Мульчирование торфом или соломой."}',
'[
  {"stage":"growing","timing":"Ранней весной при распускании почек","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"15 г на 1 м² под куст","method":"root","notes":""},
  {"stage":"fruiting","timing":"После плодоношения","fertilizer_type":"PK","product_example":"Суперфосфат+сульфат калия","dose":"По 20 г на 1 м²","method":"root","notes":"Закладка урожая следующего года"}
]',
'[{"name":"Мучнистая роса американская","symptoms":"Белый налёт на ягодах и листьях, буреет","conditions":"Загущённые посадки","treatment":"Топаз, Скор, раствор соды","prevention":"Прореживание куста, нормировка побегов"},{"name":"Антракноз","symptoms":"Бурые пятна с оранжевыми бугорками на листьях","conditions":"Влажность","treatment":"Бордоская смесь","prevention":"Уборка листвы осенью"}]',
'[{"name":"Почковый клещ","signs":"Вздутые круглые почки весной","treatment":"Вырезать поражённые ветви, Акарин","prevention":"Здоровый посадочный материал"},{"name":"Смородинная стеклянница","signs":"Усыхание отдельных ветвей","treatment":"Вырезать и сжечь ветви","prevention":"Осмотр при обрезке"}]',
'{"Чёрная смородина с малиной — нежелательно (общие болезни)","Крыжовник"}',
'{"Малина (усиливает болезни)","Облепиха"}',
'{"Ягодные культуры"}'),

-- ---- КРЫЖОВНИК ----
('Крыжовник', 'berry', NULL, NULL, NULL, NULL, 8, false,
'Долговечный куст. Любит солнечное место. Требует ежегодной обрезки.',
'{
  "6": {"transplant_start":60,"transplant_end":91},
  "5": {"transplant_start":74,"transplant_end":105},
  "4": {"transplant_start":85,"transplant_end":115},
  "3": {"transplant_start":91,"transplant_end":125}
}',
'{"growing":{"freq_days":10,"amount_l_m2":7},"fruiting":{"freq_days":5,"amount_l_m2":10},"notes":"Умеренный полив. В период созревания — регулярный."}',
'[
  {"stage":"growing","timing":"Ранней весной","fertilizer_type":"N","product_example":"Аммиачная селитра","dose":"15 г на 1 м²","method":"root","notes":""},
  {"stage":"fruiting","timing":"После плодоношения","fertilizer_type":"PK","product_example":"Суперфосфат+зола","dose":"По 30 г и 0,5 кг на куст","method":"root","notes":""}
]',
'[{"name":"Мучнистая роса американская (сферотека)","symptoms":"Белый мучнистый налёт на молодых побегах, ягодах","conditions":"Загущённые посадки, сухость","treatment":"Топаз, Скор, раствор кальцинированной соды","prevention":"Прореживание, устойчивые сорта"},{"name":"Антракноз","symptoms":"Бурые пятна на листьях, листопад в июле","conditions":"Дождливое лето","treatment":"Бордоская смесь","prevention":"Обработка до цветения"}]',
'[{"name":"Крыжовниковая огнёвка","signs":"Опутанные паутиной ягоды с личинками","treatment":"Лепидоцид до цветения","prevention":"Мульчирование — личинки не могут выбраться"},{"name":"Крыжовниковая пяденица","signs":"Объедание листьев гусеницами","treatment":"Актеллик, Битоксибациллин","prevention":""}]',
'{"Смородина чёрная","Яблоня (улучшает опыление)"}',
'{"Малина (общие болезни)","Фенхель"}',
'{}'),

-- ---- АРБУЗ ----
('Арбуз', 'berry', 130, 160, 30, 90, 5, true,
'Теплолюбивая бахчевая культура. В средней полосе — только рассадный метод в теплицу.',
'{
  "6": {"sow_start":105,"sow_end":121,"transplant_start":135,"transplant_end":152},
  "5": {"sow_start":121,"sow_end":140,"transplant_start":148,"transplant_end":165},
  "4": {"sow_start":130,"sow_end":148,"transplant_start":158,"transplant_end":175},
  "3": {"sow_start":140,"sow_end":158,"transplant_start":168,"transplant_end":182}
}',
'{"growing":{"freq_days":5,"amount_l_m2":6},"fruiting":{"freq_days":7,"amount_l_m2":4},"notes":"В период созревания плодов полив резко сокращают — улучшает сахаристость."}',
'[
  {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"N","product_example":"Мочевина","dose":"10 г на 10 л","method":"root","notes":""},
  {"stage":"flowering","timing":"В начале цветения","fertilizer_type":"PK","product_example":"Монофосфат калия","dose":"15 г на 10 л","method":"root","notes":""},
  {"stage":"fruiting","timing":"Плоды размером с кулак","fertilizer_type":"K","product_example":"Сульфат калия","dose":"20 г на 10 л","method":"root","notes":"Сахаристость"}
]',
'[{"name":"Антракноз","symptoms":"Оливковые пятна на листьях, вдавленные на плодах","conditions":"Влажность","treatment":"Бордоская смесь","prevention":"Севооборот"}]',
'[{"name":"Паутинный клещ","signs":"Паутина, обесцвечивание листьев","treatment":"Фитоверм","prevention":"Поддержание влажности воздуха"},{"name":"Бахчевая тля","signs":"Колонии под листьями","treatment":"Актара","prevention":""}]',
'{"Кукуруза","Базилик"}',
'{"Картофель","Тыква"}',
'{"Лук","Бобовые","Корнеплодные"}'),

-- ---- ДЫНЯ ----
('Дыня', 'berry', 130, 160, 30, 90, 5, true,
'Теплолюбивая бахчевая. Более влагочувствительная, чем арбуз.',
'{
  "6": {"sow_start":105,"sow_end":121,"transplant_start":130,"transplant_end":152},
  "5": {"sow_start":121,"sow_end":140,"transplant_start":148,"transplant_end":165},
  "4": {"sow_start":130,"sow_end":148,"transplant_start":158,"transplant_end":175},
  "3": {"sow_start":140,"sow_end":158,"transplant_start":168,"transplant_end":182}
}',
'{"growing":{"freq_days":5,"amount_l_m2":6},"fruiting":{"freq_days":8,"amount_l_m2":4},"notes":"Перед созреванием полив сокращать — трескается при избытке влаги."}',
'[
  {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"NPK","product_example":"Нитроаммофоска","dose":"15 г на 10 л","method":"root","notes":""},
  {"stage":"fruiting","timing":"При завязывании плодов","fertilizer_type":"K","product_example":"Сульфат калия","dose":"20 г на 10 л","method":"root","notes":""}
]',
'[{"name":"Мучнистая роса","symptoms":"Белый налёт на листьях","conditions":"Жара + влажность","treatment":"Коллоидная сера","prevention":"Проветривание теплицы"}]',
'[{"name":"Бахчевая тля","signs":"Колонии под листьями","treatment":"Актара","prevention":""},{"name":"Паутинный клещ","signs":"Паутина","treatment":"Фитоверм","prevention":""}]',
'{"Кукуруза"}',
'{"Картофель","Тыква","Огурец (конкурируют)"}',
'{"Лук","Бобовые","Корнеплодные"}'),

-- ---- ПЕРЕЦ ОСТРЫЙ ----
('Перец острый', 'vegetable', 45, 75, 75, 130, 3, true,
'Агротехника аналогична сладкому перцу. Острота зависит от нагрева — чем суше и жарче, тем острее.',
'{
  "6": {"sow_start":25,"sow_end":45,"transplant_start":105,"transplant_end":121},
  "5": {"sow_start":46,"sow_end":70,"transplant_start":135,"transplant_end":150},
  "4": {"sow_start":65,"sow_end":85,"transplant_start":152,"transplant_end":165},
  "3": {"sow_start":80,"sow_end":95,"transplant_start":163,"transplant_end":175}
}',
'{"growing":{"freq_days":4,"amount_l_m2":4},"flowering":{"freq_days":3,"amount_l_m2":5},"fruiting":{"freq_days":5,"amount_l_m2":4},"notes":"Умеренный полив. Засуха усиливает остроту. Тёплая вода."}',
'[
  {"stage":"growing","timing":"Через 2 недели после высадки","fertilizer_type":"NPK","product_example":"Кемира","dose":"10 г на 10 л","method":"root","notes":""},
  {"stage":"fruiting","timing":"Каждые 2 недели","fertilizer_type":"PK","product_example":"Монофосфат калия","dose":"15 г на 10 л","method":"root","notes":""}
]',
'[{"name":"Фитофтороз","symptoms":"Бурые пятна на листьях","conditions":"Влажность","treatment":"Ридомил Голд","prevention":"Проветривание"}]',
'[{"name":"Тля","signs":"Колонии на побегах","treatment":"Актеллик","prevention":"Бархатцы рядом"}]',
'{"Базилик","Морковь","Баклажан"}',
'{"Горох","Фасоль","Фенхель"}',
'{"Бобовые","Капуста","Огурец"}'),

-- ---- ХРЕН ----
('Хрен', 'vegetable', 74, 110, NULL, 180, 7, false,
'Многолетник. Тяжело вывести — планировать место тщательно. Хороший акарицид.',
'{
  "6": {"transplant_start":60,"transplant_end":91},
  "5": {"transplant_start":74,"transplant_end":105},
  "4": {"transplant_start":85,"transplant_end":115},
  "3": {"transplant_start":91,"transplant_end":121}
}',
'{"growing":{"freq_days":7,"amount_l_m2":6},"notes":"Засухоустойчив. Умеренный полив."}',
'[{"stage":"growing","timing":"Ранней весной при отрастании","fertilizer_type":"NPK","product_example":"Нитроаммофоска","dose":"20 г на 10 л","method":"root","notes":""}]',
'[]',
'[{"name":"Крестоцветная блошка","signs":"Дырки на листьях","treatment":"Зола","prevention":""}]',
'{"Картофель"}',
'{}',
'{}'),

-- ---- РЕВЕНЬ ----
('Ревень', 'vegetable', 60, 100, 60, 365, 5, false,
'Многолетник. Едят черешки. Листья ядовиты. Первые 2 года не срезать.',
'{
  "6": {"sow_start":50,"sow_end":91,"transplant_start":74,"transplant_end":105},
  "5": {"sow_start":60,"sow_end":100,"transplant_start":85,"transplant_end":115},
  "4": {"sow_start":74,"sow_end":110,"transplant_start":91,"transplant_end":121},
  "3": {"sow_start":85,"sow_end":115,"transplant_start":100,"transplant_end":130}
}',
'{"growing":{"freq_days":5,"amount_l_m2":8},"notes":"Влаголюбив. Мульчирование перегноем."}',
'[{"stage":"growing","timing":"Ранней весной","fertilizer_type":"NPK","product_example":"Нитроаммофоска","dose":"20 г на 1 м²","method":"root","notes":""},{"stage":"growing","timing":"После срезки черешков","fertilizer_type":"NPK","product_example":"Кемира","dose":"20 г на 1 м²","method":"root","notes":"Восстановление куста"}]',
'[{"name":"Рамуляриоз","symptoms":"Красноватые пятна на листьях","conditions":"Влажность","treatment":"Бордоская смесь","prevention":""}]',
'[{"name":"Тля","signs":"Колонии на листьях","treatment":"Мыльный раствор","prevention":""}]',
'{"Капуста","Редис","Салат","Шпинат","Горох","Фасоль"}',
'{}',
'{}'),

-- ---- ПАСТЕРНАК ----
('Пастернак', 'vegetable', 80, 121, NULL, 120, 6, false,
'Ценный корнеплод с высоким содержанием сахара. Долго прорастает (20-25 дней). Оставляют зимовать в почве.',
'{
  "6": {"sow_start":70,"sow_end":110},
  "5": {"sow_start":80,"sow_end":121},
  "4": {"sow_start":91,"sow_end":130},
  "3": {"sow_start":100,"sow_end":140}
}',
'{"growing":{"freq_days":6,"amount_l_m2":6},"notes":"Умеренный полив. Нерегулярный — корнеплод трескается."}',
'[{"stage":"growing","timing":"В фазе 3-4 листьев","fertilizer_type":"NPK","product_example":"Нитрофоска","dose":"15 г на 10 л","method":"root","notes":""}]',
'[]',
'[{"name":"Морковная муха","signs":"Ходы в корнеплоде","treatment":"Актара","prevention":"Рядом с луком"}]',
'{"Салат","Горох","Редис"}',
'{"Лук репчатый","Чеснок"}',
'{}')

ON CONFLICT (name) DO NOTHING;
