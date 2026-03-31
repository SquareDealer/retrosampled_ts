export interface User {
  id: string;
  email: string;
  password?: string; // Не возвращайте пароль клиенту!
  name?: string;
  createdAt?: string; // или Date, если используете объекты Date
  updatedAt?: string;
}
