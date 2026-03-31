import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createVerify, createPublicKey } from 'crypto';
import https from 'https';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private publicKey: string | null = null;

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const auth = req.headers['authorization'] as string | undefined;
    let token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token && req.cookies?.['access_token']) {
      token = req.cookies['access_token'];
    }

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8'),
      );

      // Проверяем истечение токена
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        throw new UnauthorizedException('Token expired');
      }

      // Сохраняем оригинальный токен для использования в сервисах
      req.user = payload;
      req.token = token;

      return true;
    } catch (error) {
      console.error('Token error:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async fetchPublicKey(): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const jwks = JSON.parse(data);
            const key = jwks.keys[0];
            resolve(this.jwkToPem(key));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  private jwkToPem(jwk: any): string {
    // Преобразование JWK в PEM формат (упрощённо)
    const publicKey = createPublicKey({
      key: jwk,
      format: 'jwk',
    });
    return publicKey.export({ format: 'pem', type: 'spki' }).toString();
  }

  private verifyToken(token: string, publicKey: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const verify = createVerify('RSA-SHA256');
    verify.update(`${parts[0]}.${parts[1]}`);

    if (!verify.verify(publicKey, Buffer.from(parts[2], 'base64'))) {
      throw new Error('Token signature invalid');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  }
}