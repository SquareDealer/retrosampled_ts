import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Same as JwtAuthGuard but never rejects: usable with `@UseGuards()` on routes
 * that serve both guests and signed-in users. Prefer the `@OptionalAuth()`
 * decorator, which makes the global guard behave this way.
 */
@Injectable()
export class OptionalAuthGuard extends JwtAuthGuard {
  protected isOptional(_context: ExecutionContext): boolean {
    void _context;
    return true;
  }
}
