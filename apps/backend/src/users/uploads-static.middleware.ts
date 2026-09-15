import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { resolve, sep } from 'path';

/**
 * Serves `LOCAL_STORAGE_DIR` at `/uploads/*` (avatars now; audio, covers and
 * peaks once Task 3.1a's local storage driver is merged).
 *
 * Implemented on top of `res.sendFile` instead of `express.static` because
 * `express` is only a transitive dependency of `@nestjs/platform-express`.
 * Mounting `main.ts`'s own static handler on the same prefix after the merge
 * is harmless: whichever answers first wins, the other never runs.
 */
@Injectable()
export class UploadsStaticMiddleware implements NestMiddleware {
  private readonly logger = new Logger(UploadsStaticMiddleware.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('LOCAL_STORAGE_DIR') ?? './uploads');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }


    // Nest hands the middleware the un-stripped URL, so remove the mount
    // prefix ourselves; the query string never matters for a static file.
    const fullPath = (req.originalUrl ?? req.url).split('?')[0];

    let relative: string;
    try {
      relative = decodeURIComponent(fullPath.replace(/^\/uploads\/?/, '').replace(/^\/+/, ''));
    } catch {
      next();
      return;
    }

    if (!relative) {
      next();
      return;
    }

    const target = resolve(this.root, relative);

    // Never escape the storage directory.
    if (!target.startsWith(this.root + sep)) {
      next();
      return;
    }

    // `root` + relative path: the dotfile rule then only applies to the object
    // key, not to the storage directory itself (which may live under a
    // dot-folder such as `.claude/worktrees`).
    res.sendFile(relative, { root: this.root, dotfiles: 'deny' }, (error?: Error) => {
      if (error) {
        this.logger.debug(`static miss ${fullPath}: ${error.message}`);
        next();
      }
    });
  }
}
