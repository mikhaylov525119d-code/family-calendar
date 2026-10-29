# Подключение Firebase (≈10 минут)

Нужен Google-аккаунт. Всё бесплатно (тариф Spark), карту привязывать не нужно.

## 1. Создать проект
1. Открыть https://console.firebase.google.com → **Создать проект** (Create a project).
2. Название: `family-calendar` (любое).
3. Google Analytics — **выключить**, он не нужен.
4. Нажать **Создать проект**.

## 2. Зарегистрировать веб-приложение
1. На главной странице проекта нажать значок **`</>`** (Web).
2. Название: `Календарь`. Галочку Firebase Hosting **не ставить**.
3. Нажать **Register app**. Появится блок `const firebaseConfig = { ... }`.
4. **Скопировать этот блок и прислать мне в чат.** Это не секрет: эти ключи всё равно видны в коде любого сайта на Firebase, данные защищают правила из шага 5.

## 3. Включить вход по паролю
1. Меню слева: **Build → Authentication → Get started**.
2. Вкладка **Sign-in method** → **Email/Password** → включить первый переключатель → **Save**.
3. Вкладка **Users** → **Add user**:
   - Email: `family@example.com`
   - Password: `525119`
4. Вкладка **Settings** → **User actions** → снять галочку **Enable create (sign-up)** → Save.
   (Чтобы никто посторонний не мог завести себе аккаунт.)

## 4. Создать базу данных
1. Меню слева: **Build → Firestore Database → Create database**.
2. Location: `eur3 (europe-west)` → Next.
3. Режим: **Start in production mode** → Create.

## 5. Правила безопасности
1. В Firestore открыть вкладку **Rules**.
2. Заменить всё содержимое текстом из файла `firestore.rules` (лежит рядом с этой инструкцией).
3. Нажать **Publish**.

## Готово
Пришли мне конфиг из шага 2 — я вставлю его в `js/config.js` и проверю синхронизацию.

> Пароль семьи можно сменить позже: Authentication → Users → ⋮ у пользователя → Reset password.
