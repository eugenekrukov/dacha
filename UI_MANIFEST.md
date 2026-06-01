# UI Manifest — Календарь дачника
> Стек: Android · Jetpack Compose · Material 3  
> Статус: **УТВЕРЖДЁН и применён** · Solar Dacha · 2026-06-02  
> Дизайн-вариант: **Solar Dacha** — Nunito Black, оранжевый `#FF7B00`, кремовый `#FFF8EB`

---

## 0. Принципы

1. **Единый источник правды** — все отступы, цвета и размеры берутся из токенов ниже, не хардкодятся.
2. **Резиновость** — UI обязан корректно работать на экранах от 360dp до 420dp шириной.
3. **Текст не ломается** — динамический текст всегда имеет явный `maxLines` + `overflow = TextOverflow.Ellipsis`.
4. **Иконки всегда парные** — иконка без подписи не используется в кнопках действий (только в навбаре).

---

## 1. Сетка и отступы

### 1.1 Базовая единица

```
BASE = 4.dp
```

Все отступы — кратные BASE. Допустимые значения:

| Токен | dp | Применение |
|-------|----|------------|
| `Space.XXS` | 2dp | **Запрещён** как gap между смысловыми блоками. Только для выравнивания декора (точки, разделители) |
| `Space.XS` | 4dp | Расстояние между иконкой и подписью внутри кнопки |
| `Space.S` | 8dp | Расстояние между строками внутри карточки |
| `Space.M` | 12dp | Gap между карточками / чипами в строке |
| `Space.L` | 16dp | Горизонтальный padding экрана (contentPadding LazyColumn) |
| `Space.XL` | 20dp | Padding между секциями |
| `Space.XXL` | 24dp | Vertical padding у шапок экрана |

### 1.2 Правила применения

```kotlin
// ✅ Правильно
LazyColumn(
    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp)
)

// ❌ Запрещено — несистемные значения
Spacer(modifier = Modifier.height(2.dp))   // нарушает ритм
Spacer(modifier = Modifier.height(6.dp))   // нарушает ритм

// ✅ Правильно — минимальный gap между текстовыми строками
Spacer(modifier = Modifier.height(8.dp))
```

### 1.3 Section title — ритм заголовков секций

```kotlin
// ❌ Найдено в TodayScreen.kt (Lines 195, 233): padding(top = 4.dp)
Text(text = "Задачи сегодня", modifier = Modifier.padding(top = 4.dp))

// ✅ Правило: заголовок секции отделяется от предыдущего блока через spacedBy LazyColumn
// либо явным Spacer(height = 20.dp) перед заголовком, 8.dp после него
Spacer(modifier = Modifier.height(20.dp))
Text(text = "Задачи сегодня", style = MaterialTheme.typography.titleMedium,
     fontWeight = FontWeight.SemiBold)
Spacer(modifier = Modifier.height(8.dp))
```

### 1.4 Card padding

```kotlin
// Единый внутренний padding для всех Card
Card {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) { ... }
}
```

---

## 2. Типографика

### 2.1 Шкала размеров

| Роль | Style | Size | Weight | Использование |
|------|-------|------|--------|---------------|
| Заголовок экрана | `headlineMedium` | 28sp | **Bold** | Верхний заголовок (пр. "Сегодня") |
| Заголовок секции | `titleMedium` | 16sp | **SemiBold** | "Задачи сегодня", "Погода" |
| Заголовок карточки | `titleSmall` | 14sp | **Medium** | Название культуры, задачи |
| Тело / описание | `bodyMedium` | 14sp | Normal | Основной контент |
| Вспомогательный | `bodySmall` | 12sp | Normal | Даты, метки, подсказки |
| Кнопка | `labelLarge` | 14sp | **Medium** | Текст кнопок |
| Чип / метка | `labelSmall` | 11sp | Normal | Фильтры, теги |

### 2.2 Обязательные правила

```kotlin
// ✅ ПРАВИЛО: заголовок экрана всегда Bold
Text(
    text = "Сегодня",
    style = MaterialTheme.typography.headlineMedium,
    fontWeight = FontWeight.Bold    // ← явно, не полагаться на defaults
)

// ✅ ПРАВИЛО: динамический контент — всегда maxLines + Ellipsis
Text(
    text = planting.cropName,       // может быть длинным
    maxLines = 1,
    overflow = TextOverflow.Ellipsis,
    style = MaterialTheme.typography.titleSmall
)

// ✅ ПРАВИЛО: составной динамический текст
Text(
    text = "→ ${next.name}: $whenText",   // PlantingsScreen.kt Line 281
    maxLines = 1,
    overflow = TextOverflow.Ellipsis
)

// ❌ Запрещено — текст без ограничений рядом с переменными данными
Text(text = "→ ${next.name}: $whenText")
```

### 2.3 Плотные текстовые стеки

Правило: между смысловыми строками **минимум 8.dp**. Если в карточке 3+ строки — применить иерархию через `alpha`.

```kotlin
// ❌ Найдено в PlantingsScreen.kt (Lines 244-258): 5 строк с 2.dp spacer
Column {
    Text(text = planting.cropName, ...)
    Spacer(Modifier.height(2.dp))    // запрещено
    Text(text = planting.date, ...)
    Spacer(Modifier.height(2.dp))    // запрещено
}

// ✅ Правило
Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Text(text = planting.cropName, style = typography.titleSmall, fontWeight = FontWeight.Medium)
    Text(text = planting.date, style = typography.bodySmall,
         color = MaterialTheme.colorScheme.onSurfaceVariant)
}
```

---

## 3. Кнопки

### 3.1 Высота и touch target

```kotlin
// Единая высота для всех Button/FilledButton
Button(
    modifier = Modifier
        .fillMaxWidth()
        .height(52.dp),           // ← фиксировано
    contentPadding = PaddingValues(horizontal = 16.dp)
) {
    Text(
        text = "Зарегистрироваться",
        maxLines = 1,             // ← обязательно
        overflow = TextOverflow.Ellipsis,
        softWrap = false          // ← запрет переноса
    )
}
```

### 3.2 Quick Action кнопки (3 в ряд)

```kotlin
// ❌ Найдено в TodayScreen.kt (Lines 473-478): contentPadding 8/10.dp, gap иконка-текст 2.dp
OutlinedButton(
    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
) {
    Icon(size = 20.dp)
    Spacer(width = 2.dp)   // запрещено
    Text(text = "Полил")
}

// ✅ Правило для кнопок в 3-колоночной сетке
OutlinedButton(
    modifier = Modifier
        .weight(1f)
        .height(56.dp),
    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 8.dp)
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(modifier = Modifier.size(20.dp), ...)
        Text(
            text = "Полил",
            style = MaterialTheme.typography.labelSmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            softWrap = false
        )
    }
}
```

### 3.3 Динамический текст в кнопках

```kotlin
// ❌ Найдено в OnboardingCropsScreen.kt (Line 96): "Добавить ($count)"
Button { Text("Добавить ($count)") }

// ✅ Правило
Button { 
    Text(
        text = "Добавить ($count)",
        maxLines = 1,
        softWrap = false,
        overflow = TextOverflow.Ellipsis
    ) 
}
```

### 3.4 Тип кнопки по контексту

| Тип | Применение |
|-----|-----------|
| `Button` (filled) | Главное CTA экрана (1 на экран) |
| `OutlinedButton` | Второстепенные действия, Quick Actions |
| `TextButton` | "Пропустить", "Отмена" |
| `FilledTonalButton` | Подтверждающие действия в Bottom Sheet |
| `ElevatedButton` | **Не использовать** — конфликтует с карточками |

---

## 4. Инпуты

```kotlin
// Единый стиль для всех текстовых полей
OutlinedTextField(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(12.dp),    // ← единый радиус
    singleLine = true,                    // ← если однострочное
    maxLines = 1,                         // ← дублировать для надёжности
)

// Многострочное поле (заметки, журнал)
OutlinedTextField(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(12.dp),
    maxLines = 4,
    minLines = 3,
)
```

### 4.1 Два инпута рядом (HarvestScreen.kt Lines 347-361)

```kotlin
// ❌ Найдено: два TextField в Row без явных весов
Row { TextField(...); Spacer(12.dp); TextField(...) }

// ✅ Правило — явные веса
Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    OutlinedTextField(modifier = Modifier.weight(1f), ...)
    OutlinedTextField(modifier = Modifier.weight(1f), ...)
}
```

---

## 5. Карточки

```kotlin
// Единый стиль Card
Card(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    colors = CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.surface
    ),
    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
        // контент
    }
}

// ElevatedCard — для выделенных блоков (погода, сводка)
ElevatedCard(
    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 4.dp),
    shape = RoundedCornerShape(16.dp)
)
```

### 5.1 Скругления

| Компонент | Радиус |
|-----------|--------|
| Card | 16.dp |
| OutlinedTextField | 12.dp |
| Button (filled/outlined) | 12.dp (Material default) |
| Chip / FilterChip | 8.dp |
| Bottom Sheet | topStart = 20.dp, topEnd = 20.dp |
| Индикатор точка | 50% (круг, 6.dp) |

---

## 6. Иконки

### 6.1 Размеры

| Контекст | Размер |
|----------|--------|
| Navigation bar | 24.dp |
| Заголовок карточки | 20.dp |
| Quick Action кнопки | 20.dp |
| Inline-текст иконка | 18.dp |
| Кнопки в AppBar | 24.dp |
| Пустой стейт (hero) | 64.dp |

**Запрещено:** смешивать 18.dp и 20.dp в одной смысловой группе.

### 6.2 Иконка + текст — правила отступов

```kotlin
// ✅ Единый паттерн для иконки рядом с текстом
Row(verticalAlignment = Alignment.CenterVertically) {
    Icon(
        modifier = Modifier.size(18.dp),
        tint = MaterialTheme.colorScheme.primary
    )
    Spacer(modifier = Modifier.width(8.dp))    // всегда 8.dp (Space.S)
    Text(text = "Название")
}

// ✅ Внутри кнопки
Button {
    Icon(modifier = Modifier.size(18.dp))
    Spacer(modifier = Modifier.width(8.dp))    // ← НЕ 2.dp как в TodayScreen
    Text(text = "Действие", softWrap = false)
}
```

### 6.3 Эмодзи как иконки

Эмодзи допустимы только в:
- Hero-иллюстрациях пустых стейтов (размер 48–64sp)
- Заголовках культур (префикс, 1 эмодзи максимум)

**Запрещены** в:
- Кнопках действий (использовать Material Icons)
- Quick Action сетке
- Чипах фильтрации

```kotlin
// ❌ Найдено: "📝 Записать действие", "🌱 Посадить"
Button { Text("📝 Записать действие") }

// ✅ Правило
Button {
    Icon(imageVector = Icons.Outlined.Edit, modifier = Modifier.size(18.dp))
    Spacer(Modifier.width(8.dp))
    Text("Записать действие", softWrap = false)
}
```

---

## 7. Цвета — запрет хардкода

```kotlin
// ❌ Найдено в нескольких местах
color = Color(0xFF2E7D32)
color = Color(0xFFE65100)

// ✅ Использовать только токены темы
color = MaterialTheme.colorScheme.primary
color = MaterialTheme.colorScheme.tertiary
color = MaterialTheme.colorScheme.error
// Или через taskColor() из Theme.kt для задач
```

Исключение: задачи/статусы — через `taskColor(type)` из `Theme.kt`. Добавлять новые цвета только туда.

---

## 8. Чипы и теги

```kotlin
FilterChip(
    shape = RoundedCornerShape(8.dp),
    label = {
        Text(
            text = chipLabel,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            softWrap = false,
            style = MaterialTheme.typography.labelSmall
        )
    }
)
```

---

## 9. Пустые стейты

```kotlin
// Единый паттерн empty state
Column(
    modifier = Modifier.fillMaxWidth().padding(32.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(12.dp)
) {
    Text(text = "🌿", fontSize = 48.sp)          // эмодзи — допустимо здесь
    Text(
        text = "Нет посадок",
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold
    )
    Text(
        text = "Добавьте первую культуру",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center
    )
}
```

---

## 10. Мобильные UX-правила (из ui-ux-pro-max)

### 10.1 Touch target spacing

Между соседними кнопками и кликабельными элементами — минимум **8dp** зазора.

```kotlin
// ✅ Правило
Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    OutlinedButton(...) { ... }
    OutlinedButton(...) { ... }
}

// ❌ Запрещено
Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { ... }
Row { Button(...); Button(...) }  // вплотную
```

### 10.2 Анимации — easing

| Направление | Easing | Применение |
|-------------|--------|-----------|
| Элемент **входит** (появляется) | `EaseOut` | Bottom Sheet открывается, карточка появляется |
| Элемент **уходит** (скрывается) | `EaseIn` | Bottom Sheet закрывается, диалог исчезает |
| Микро-интеракция (нажатие) | `EaseInOut` | Ripple, scale на кнопке |

```kotlin
// ✅ Bottom Sheet / enter animation
tween(durationMillis = 300, easing = EaseOut)

// ✅ Exit animation
tween(durationMillis = 200, easing = EaseIn)

// ❌ Запрещено для UI-переходов
tween(durationMillis = 300, easing = LinearEasing)  // выглядит механически
```

Длительность: **150–200ms** для микро-интеракций, **250–300ms** для Bottom Sheet и экранных переходов.

### 10.3 Pull-to-refresh

Не вешать `nestedScroll` и pull-to-refresh на экраны, где это не ожидается пользователем.

```kotlin
// ✅ Только там, где пользователь ждёт обновления (TodayScreen, PlantingsScreen)
val pullState = rememberPullToRefreshState()
PullToRefreshBox(state = pullState, onRefresh = { viewModel.load() }) {
    LazyColumn { ... }
}

// ❌ Запрещено на статичных экранах (Settings, CropDetail, Calendar)
// Не добавлять PullToRefreshBox без явной необходимости
```

---

## 11. Чеклист перед мержем экрана

- [ ] Все заголовки экрана имеют `fontWeight = FontWeight.Bold`
- [ ] Анимации используют `EaseOut` на вход, `EaseIn` на выход (не `LinearEasing`)
- [ ] `PullToRefresh` только на экранах с живыми данными (Today, Plantings)
- [ ] Между соседними кнопками минимум `8dp` зазора
- [ ] Все динамические тексты (`${variable}`) имеют `maxLines` + `overflow = Ellipsis`
- [ ] Кнопки с текстом имеют `softWrap = false`
- [ ] Нет `Spacer(height = 2.dp)` или `Spacer(height = 6.dp)` между блоками
- [ ] Иконки в кнопках отделены `Spacer(width = 8.dp)`, не меньше
- [ ] Нет хардкода цветов вне `Theme.kt`
- [ ] Два поля в `Row` используют `Modifier.weight(1f)`
- [ ] Эмодзи в кнопках заменены на Material Icons

---

## Найденные нарушения по экранам

| Файл | Строки | Нарушение | Приоритет |
|------|--------|-----------|-----------|
| `TodayScreen.kt` | 477–478 | Spacer(width=2.dp) между иконкой и текстом кнопки | 🔴 Высокий |
| `TodayScreen.kt` | 473 | contentPadding 8/10.dp — текст обрежется на 360dp | 🔴 Высокий |
| `TodayScreen.kt` | 195, 233 | Section title padding(top=4.dp) — нарушает ритм | 🟡 Средний |
| `PlantingsScreen.kt` | 244–258 | 5 строк с Spacer(2.dp) — нечитаемо | 🟡 Средний |
| `PlantingsScreen.kt` | 281 | Нет maxLines на динамическом тексте | 🟡 Средний |
| `TodayScreen.kt` | 159 | "Сегодня" без Bold | 🟡 Средний |
| `RegisterScreen.kt` | 142 | "Зарегистрироваться" без softWrap=false | 🟠 Низкий |
| `HarvestScreen.kt` | 347–361 | Два TextField без weight(1f) | 🟠 Низкий |
| `PlantingsScreen.kt` | 317 | Эмодзи в тексте кнопки "📝 Записать действие" | 🟠 Низкий |
| Множество файлов | — | Хардкод `Color(0xFF...)` вне Theme.kt | 🟠 Низкий |
| `OnboardingCropsScreen.kt` | 96 | Динамическая кнопка без softWrap | 🟠 Низкий |
