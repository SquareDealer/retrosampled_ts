import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { Session, cookieHeader, createTestApp, registerUser } from './e2e-helpers';

const PREFIX = `follows-e2e-${Date.now()}`;

describe('Users, follows, notifications, search (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let alice: Session;
  let bob: Session;
  let carol: Session;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    alice = await registerUser(server, `${PREFIX}-alice@example.com`, `${PREFIX.slice(-6)}alice`);
    bob = await registerUser(server, `${PREFIX}-bob@example.com`, `${PREFIX.slice(-6)}bob`);
    carol = await registerUser(server, `${PREFIX}-carol@example.com`, `${PREFIX.slice(-6)}carol`);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  it('GET /users/:username works for guests and reports isMe/isFollowing', async () => {
    const guest = await request(server).get(`/users/${bob.username}`).expect(200);
    expect(guest.body).toMatchObject({
      id: bob.id,
      username: bob.username,
      isFollowing: false,
      isMe: false,
      stats: { followers: 0, following: 0, uploads: 0, remakes: 0, likesReceived: 0 },
    });

    const me = await request(server)
      .get(`/users/${bob.username}`)
      .set('Cookie', cookieHeader(bob.cookies))
      .expect(200);
    expect(me.body.isMe).toBe(true);

    await request(server).get(`/users/${bob.id}`).expect(200);
    await request(server).get('/users/does-not-exist').expect(404);
  });

  it('follow is idempotent, moves counters, notifies and shows up in lists', async () => {
    await request(server).post(`/users/${bob.id}/follow`).expect(401);

    const first = await request(server)
      .post(`/users/${bob.id}/follow`)
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(200);
    expect(first.body).toEqual({ following: true, followersCount: 1 });

    const again = await request(server)
      .post(`/users/${bob.id}/follow`)
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(200);
    expect(again.body).toEqual({ following: true, followersCount: 1 });

    await request(server)
      .post(`/users/${alice.id}/follow`)
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(400);

    const profile = await request(server)
      .get(`/users/${bob.username}`)
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(200);
    expect(profile.body.isFollowing).toBe(true);
    expect(profile.body.stats.followers).toBe(1);

    const followers = await request(server)
      .get(`/users/${bob.username}/followers`)
      .set('Cookie', cookieHeader(carol.cookies))
      .expect(200);
    expect(followers.body.users.map((user: { id: string }) => user.id)).toEqual([alice.id]);
    expect(followers.body.nextCursor).toBeNull();

    const following = await request(server).get(`/users/${alice.username}/following`).expect(200);
    expect(following.body.users[0]).toMatchObject({ id: bob.id, followersCount: 1, isFollowing: false });

    const unread = await request(server)
      .get('/notifications/unread-count')
      .set('Cookie', cookieHeader(bob.cookies))
      .expect(200);
    expect(unread.body).toEqual({ unreadCount: 1 });

    const list = await request(server)
      .get('/notifications')
      .set('Cookie', cookieHeader(bob.cookies))
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      type: 'FOLLOW',
      read: false,
      href: `/user/${alice.username}`,
      actor: { id: alice.id, username: alice.username },
    });

    await request(server)
      .patch(`/notifications/${list.body.items[0].id}/read`)
      .set('Cookie', cookieHeader(bob.cookies))
      .expect(200)
      .expect({ unreadCount: 0 });

    // Alice's notifications are untouched by Bob's actions.
    const aliceUnread = await request(server)
      .get('/notifications/unread-count')
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(200);
    expect(aliceUnread.body.unreadCount).toBe(0);
  });

  it('paginates followers with an opaque cursor and rejects it under other facets', async () => {
    for (const session of [bob, carol]) {
      await request(server)
        .post(`/users/${alice.id}/follow`)
        .set('Cookie', cookieHeader(session.cookies))
        .expect(200);
    }

    const first = await request(server).get(`/users/${alice.username}/followers?limit=1`).expect(200);
    expect(first.body.users).toHaveLength(1);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await request(server)
      .get(`/users/${alice.username}/followers?limit=1&cursor=${first.body.nextCursor}`)
      .expect(200);
    expect(second.body.users).toHaveLength(1);
    expect(second.body.users[0].id).not.toBe(first.body.users[0].id);
    expect(second.body.nextCursor).toBeNull();

    await request(server)
      .get(`/users/${alice.username}/following?limit=1&cursor=${first.body.nextCursor}`)
      .expect(400);
  });

  it('unfollow is idempotent and decrements', async () => {
    const first = await request(server)
      .delete(`/users/${bob.id}/follow`)
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(200);
    expect(first.body).toEqual({ following: false, followersCount: 0 });

    const again = await request(server)
      .delete(`/users/${bob.id}/follow`)
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(200);
    expect(again.body).toEqual({ following: false, followersCount: 0 });
  });

  it('PATCH /users/me updates the profile and rejects a taken username', async () => {
    const updated = await request(server)
      .patch('/users/me')
      .set('Cookie', cookieHeader(alice.cookies))
      .send({ displayName: 'Alice A.', bio: 'hi', links: { x: 'https://x.com/alice' } })
      .expect(200);
    expect(updated.body).toMatchObject({
      displayName: 'Alice A.',
      bio: 'hi',
      links: { x: 'https://x.com/alice' },
      isMe: true,
    });

    await request(server)
      .patch('/users/me')
      .set('Cookie', cookieHeader(alice.cookies))
      .send({ username: bob.username })
      .expect(409);

    await request(server)
      .patch('/users/me')
      .set('Cookie', cookieHeader(alice.cookies))
      .send({ username: 'way-too-long-username-1' })
      .expect(400);
  });

  it('avatar upload validates the file, stores it and can be removed', async () => {
    await request(server)
      .post('/users/me/avatar')
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(400);

    await request(server)
      .post('/users/me/avatar')
      .set('Cookie', cookieHeader(alice.cookies))
      .attach('file', Buffer.from('not an image'), { filename: 'a.txt', contentType: 'text/plain' })
      .expect(400);

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const uploaded = await request(server)
      .post('/users/me/avatar')
      .set('Cookie', cookieHeader(alice.cookies))
      .attach('file', png, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(200);
    expect(uploaded.body.avatarUrl).toMatch(new RegExp(`/uploads/avatars/${alice.id}\\.png$`));

    const profile = await request(server).get(`/users/${alice.username}`).expect(200);
    expect(profile.body.avatarUrl).toBe(uploaded.body.avatarUrl);

    await request(server)
      .get(`/uploads/avatars/${alice.id}.png`)
      .expect(200)
      .expect('Content-Type', /image\/png/);

    await request(server)
      .delete('/users/me/avatar')
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(200)
      .expect({ avatarUrl: null });
  });

  it('GET /users/search and GET /search find users by handle', async () => {
    const users = await request(server).get(`/users/search?q=${PREFIX.slice(-6)}`).expect(200);
    expect(users.body.users.length).toBeGreaterThanOrEqual(3);

    const search = await request(server)
      .get(`/search?q=${PREFIX.slice(-6)}car&type=users`)
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(200);
    expect(search.body.users.map((user: { id: string }) => user.id)).toEqual([carol.id]);
    expect(search.body.samples).toEqual([]);

    await request(server).get('/search?q=x&type=nope').expect(400);
  });

  it('PATCH /notifications/read-all clears everything', async () => {
    const before = await request(server)
      .get('/notifications?unreadOnly=true')
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(200);
    expect(before.body.unreadCount).toBe(2);
    expect(before.body.items).toHaveLength(2);

    await request(server)
      .patch('/notifications/read-all')
      .set('Cookie', cookieHeader(alice.cookies))
      .expect(200)
      .expect({ unreadCount: 0 });
  });
});
