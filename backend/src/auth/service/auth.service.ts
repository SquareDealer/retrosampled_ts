import { Injectable, UnauthorizedException } from '@nestjs/common';

type SupabaseSessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'bearer';
  user: { id: string; email?: string };
};

type SupabaseSignUpResponse = {
  user: { id: string; email?: string } | null
  session: {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: 'bearer'
  } | null
}

type SupabaseErrorResponse = {
  error?: string;
  error_description?: string;
};

@Injectable()
export class AuthService {
  private supabaseUrl = process.env.SUPABASE_URL!;
  private anonKey = process.env.SUPABASE_KEY!;

  // login с паролем, возвращает сессию
  async loginWithPassword(email: string, password: string): Promise<SupabaseSessionResponse> {
    const url = `${this.supabaseUrl}/auth/v1/token?grant_type=password`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      throw new UnauthorizedException('Invalid credentials')
    }
    return (await res.json()) as SupabaseSessionResponse
  }

  // обновление сессии по refresh token
  async refresh(refreshToken: string): Promise<SupabaseSessionResponse> {
    const url = `${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      throw new UnauthorizedException('Refresh token invalid/expired')
    }
    return (await res.json()) as SupabaseSessionResponse
  }

  // registration
  async signUp(
    email: string,
    password: string,
    redirectTo?: string,
  ): Promise<SupabaseSignUpResponse> {
    const url = `${this.supabaseUrl}/auth/v1/signup`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      }),
    });

    if (!res.ok) {
      const errorData = (await res.json()) as SupabaseErrorResponse;
      console.error('Supabase signUp error:', {
        status: res.status,
        url: url,
        anonKeyPrefix: this.anonKey.substring(0, 10),
        error: errorData,
      });
      throw new UnauthorizedException(
        errorData.error_description || 'Sign up failed',
      );
    }

    return (await res.json()) as SupabaseSignUpResponse;
  }

  // sign-out, delete session server-side
  async signOut(accessToken: string): Promise<void> {
    const url = `${this.supabaseUrl}/auth/v1/logout`;
    await fetch(url, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // resets password by sending email with link
  async resetPasswordForEmail(email: string, redirectTo?: string): Promise<void> {
    const url = `${this.supabaseUrl}/auth/v1/recover`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      })
    });

    if (!res.ok) {
      const error = (await res.json()) as SupabaseErrorResponse;
      throw new UnauthorizedException(error.error_description || 'Failed to send reset email');
      }
  }

  async resetPasswordWithToken(token: string, newPassword: string) {
    const url = `${this.supabaseUrl}/auth/v1/verify`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'recovery',
        token: token,
        password: newPassword,
      }),
    });

    if (!res.ok) {
      const error = (await res.json()) as SupabaseErrorResponse;
      throw new UnauthorizedException(error.error_description || 'Failed to reset password');
    }
  }

  async changePassword(email: string, oldPassword: string, newPassword: string) {
    // Сначала логинимся с старым паролем, чтобы получить токен
    const session = await this.loginWithPassword(email, oldPassword);
    
    const url = `${this.supabaseUrl}/auth/v1/user`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!res.ok) {
      const error = (await res.json()) as SupabaseErrorResponse;
      throw new UnauthorizedException(error.error_description || 'Failed to change password');
    }
  }

  async updateUser(userId: string, data: { email?: string; password?: string }) {
    const url = `${this.supabaseUrl}/auth/v1/user`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = (await res.json()) as SupabaseErrorResponse;
      throw new UnauthorizedException(error.error_description || 'Failed to update user');
    }
    return res.json();
  }

  async deleteUser(email: string, password: string) {
    // Логинимся перед удалением
    const session = await this.loginWithPassword(email, password);
    
    const url = `${this.supabaseUrl}/auth/v1/user`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!res.ok) {
      throw new UnauthorizedException('Failed to delete account');
    }
  }

  async sendVerificationEmail(email: string) {
    const url = `${this.supabaseUrl}/auth/v1/resend`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'signup',
        email: email,
      }),
    });

    if (!res.ok) {
      const error = (await res.json()) as SupabaseErrorResponse;
      throw new UnauthorizedException(error.error_description || 'Failed to send email');
    }
  }
}
