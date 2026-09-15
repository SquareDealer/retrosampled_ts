import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DownloadResponse } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/types/authenticated-request';
import { STORAGE, StoragePort } from '../../storage/storage.port';
import { SampleAccessService, toActor } from './sample-access.service';

export const DOWNLOAD_URL_TTL_SECONDS = 10 * 60;

/**
 * `POST /samples/:id/downloads`: records the download, bumps the counter and
 * hands back a time-limited URL (a presigned GET on S3, the public URL on the
 * local driver).
 */
@Injectable()
export class DownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SampleAccessService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  async requestDownload(actor: RequestUser, sampleId: string): Promise<DownloadResponse> {
    const sample = await this.access.assertCan(toActor(actor), 'sample:download', sampleId);

    if (!sample.audioKey) {
      throw new UnprocessableEntityException('This sample has no audio file yet');
    }

    const [downloadUrl, updated] = await Promise.all([
      this.storage.signedUrl(sample.audioKey, DOWNLOAD_URL_TTL_SECONDS),
      this.prisma.$transaction(async (tx) => {
        await tx.download.create({ data: { userId: actor.id, sampleId } });
        return tx.sample.update({
          where: { id: sampleId },
          data: { downloadsCount: { increment: 1 } },
          select: { downloadsCount: true },
        });
      }),
    ]);

    return {
      downloadUrl,
      expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      downloadsCount: updated.downloadsCount,
    };
  }
}
