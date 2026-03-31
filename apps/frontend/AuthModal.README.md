# AuthModal Component

Компонент модального окна для регистрации и авторизации с валидацией.

## Возможности

- ✅ Переключение между режимами Login и Sign Up
- ✅ Валидация email (формат)
- ✅ Валидация пароля (минимум 6 символов)
- ✅ Проверка совпадения паролей при регистрации
- ✅ Кнопка "Forgot password?" в режиме входа
- ✅ Авторизация через Google (заглушка)
- ✅ Отображение ошибок под полями
- ✅ Блокировка формы во время отправки
- ✅ Закрытие по клику на overlay или кнопку ×

## Использование

```tsx
import { useState } from 'react';
import { AuthModal } from './components/AuthModal';

function App() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsAuthModalOpen(true)}>
        Log In
      </button>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        initialMode="login" // или "signup"
      />
    </>
  );
}
```

## Props

| Prop | Type | Default | Описание |
|------|------|---------|----------|
| `isOpen` | `boolean` | - | Открыто ли модальное окно |
| `onClose` | `() => void` | - | Callback для закрытия окна |
| `initialMode` | `"login" \| "signup"` | `"login"` | Начальный режим |

## Валидация

### Email
- Проверка на пустое значение
- Проверка формата через регулярное выражение

### Password
- Проверка на пустое значение
- Минимум 6 символов

### Repeat Password (только Sign Up)
- Проверка на пустое значение
- Совпадение с основным паролем

## Стилизация

Компонент использует стиль в соответствии с дизайн-системой проекта:
- Черный фон (#000)
- Белые элементы с прозрачностью (#FFFFFF20, #FFFFFF40, #FFFFFF60)
- Моноширинный шрифт "Roboto Mono"
- Строгие линии без border-radius
- Красные ошибки (#ff4444)

## Интеграция с API

Замените `setTimeout` в функции `handleSubmit` на реальный API вызов:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validateForm()) return;

  setIsSubmitting(true);

  try {
    if (mode === "login") {
      await loginAPI({ email, password });
    } else {
      await signupAPI({ email, password });
    }
    handleClose();
  } catch (error) {
    // Обработка ошибок
    setErrors({ email: "Authentication failed" });
  } finally {
    setIsSubmitting(false);
  }
};
```

## Функционал "Forgot Password"

Добавьте обработчик в кнопку:

```tsx
<button
  type="button"
  className="auth-modal__forgot"
  onClick={() => {
    // Открыть модальное окно восстановления пароля
    // или перейти на страницу восстановления
  }}
>
  Forgot password?
</button>
```

## Google OAuth

Замените заглушку в `handleGoogleAuth`:

```tsx
const handleGoogleAuth = () => {
  // Инициировать OAuth flow
  window.location.href = '/api/auth/google';
};
```
