import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { S3Storage } from './s3.storage';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async (_client, command) => {
    return `https://signed.example/${command.input.Bucket}/${command.input.Key}?sig=1`;
  }),
}));

describe('S3Storage', () => {
  const send = jest.fn();
  const storage = new S3Storage(
    {
      bucket: 'crates',
      region: 'eu-central-1',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    },
    { send } as never,
  );

  beforeEach(() => {
    send.mockReset();
  });

  it('puts with the inferred content type', async () => {
    send.mockResolvedValueOnce({});

    await storage.put('samples/1/audio.wav', Buffer.from('x'));

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'crates',
      Key: 'samples/1/audio.wav',
      ContentType: 'audio/wav',
    });
  });

  it('reads the body back as a Buffer', async () => {
    send.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });

    await expect(storage.get('samples/1/peaks.json')).resolves.toEqual(Buffer.from([1, 2, 3]));
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
  });

  it('exists() maps a 404 head to false and rethrows other errors', async () => {
    send.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    await expect(storage.exists('samples/1/cover.png')).resolves.toBe(false);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);

    send.mockResolvedValueOnce({});
    await expect(storage.exists('samples/1/cover.png')).resolves.toBe(true);

    send.mockRejectedValueOnce({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
    await expect(storage.exists('samples/1/cover.png')).rejects.toBeDefined();
  });

  it('deletes through DeleteObjectCommand', async () => {
    send.mockResolvedValueOnce({});
    await storage.delete('samples/1/audio.wav');
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('builds path-style public URLs for custom endpoints', () => {
    expect(storage.publicUrl('samples/1/audio.wav')).toBe(
      'http://localhost:9000/crates/samples/1/audio.wav',
    );
  });

  it('prefers S3_PUBLIC_URL and falls back to the AWS virtual-host URL', () => {
    const cdn = new S3Storage(
      {
        bucket: 'crates',
        region: 'eu-central-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
        publicBaseUrl: 'https://cdn.example/',
      },
      { send } as never,
    );
    expect(cdn.publicUrl('a/b.png')).toBe('https://cdn.example/a/b.png');

    const aws = new S3Storage(
      { bucket: 'crates', region: 'eu-central-1', accessKeyId: 'k', secretAccessKey: 's' },
      { send } as never,
    );
    expect(aws.publicUrl('a/b.png')).toBe('https://crates.s3.eu-central-1.amazonaws.com/a/b.png');
  });

  it('presigns GET for signedUrl', async () => {
    await expect(storage.signedUrl('samples/1/audio.wav', 300)).resolves.toBe(
      'https://signed.example/crates/samples/1/audio.wav?sig=1',
    );
  });
});
