import 'dotenv/config';
import { env } from './config/env';
import { google } from 'googleapis';

const success = (msg: string) => console.log(`✅ ${msg}`);
const fail = (msg: string) => console.log(`❌ ${msg}`);

const results = {
  passed: 0,
  failed: 0,
};

function ok(msg: string) {
  results.passed++;
  success(msg);
}

function bad(msg: string) {
  results.failed++;
  fail(msg);
}

function mask(value?: string) {
  if (!value) return '(empty)';
  if (value.length < 12) return '********';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function section(title: string) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(title);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function logError(err: any) {
  bad(err?.message || 'Unknown error');

  const data =
    err?.response?.data ||
    err?.errors ||
    err;

  if (data) {
    console.log('\n📋 Error Details');
    console.log(JSON.stringify(data, null, 2));
  }
}

async function testEnvironment() {
  section('1️⃣ Environment Variables');

  const vars = [
    'GOOGLE_AI_API_KEY',
    'BLOGGER_BLOG_ID',
    'BLOGGER_CLIENT_ID',
    'BLOGGER_CLIENT_SECRET',
    'BLOGGER_REFRESH_TOKEN',
    'ADSTERRA_API_TOKEN',
  ];

  for (const key of vars) {
    const value = process.env[key];

    if (value) {
      ok(`${key.padEnd(30)} ${mask(value)}`);
    } else {
      bad(`${key} missing`);
    }
  }
}

async function testGoogleAI() {
  section('2️⃣ Google AI');

  try {
    const { generateContent } = await import('./providers/google-ai');

    const response = await generateContent(
      'Reply ONLY with GOOGLE_AI_OK'
    );

    ok(`Response: ${response}`);
  } catch (err: any) {
    logError(err);
  }
}

async function createOAuthClient() {
  section('3️⃣ Blogger OAuth');

  try {
    const auth = new google.auth.OAuth2(
      env.BLOGGER_CLIENT_ID,
      env.BLOGGER_CLIENT_SECRET
    );

    auth.setCredentials({
      refresh_token: env.BLOGGER_REFRESH_TOKEN,
    });

    const token = await auth.getAccessToken();

    if (!token.token) {
      throw new Error('No access token');
    }

    ok('Refresh token valid');
    ok('Access token acquired');

    return auth;
  } catch (err: any) {
    logError(err);
    return null;
  }
}

async function testGoogleAccount(auth: any) {
  section('4️⃣ Google Account');

  if (!auth) return;

  try {
    const oauth2 = google.oauth2({
      version: 'v2',
      auth,
    });

    const me = await oauth2.userinfo.get();

    ok(`Email: ${me.data.email}`);
    ok(`Verified: ${me.data.verified_email}`);
  } catch (err: any) {
    logError(err);
  }
}

async function testScopes(auth: any) {
  section('5️⃣ Token Scopes');

  if (!auth) return;

  try {
    const accessToken =
      (await auth.getAccessToken()).token;

    if (!accessToken) {
      throw new Error('No access token');
    }

    const info =
      await auth.getTokenInfo(accessToken);

    for (const scope of info.scopes || []) {
      ok(scope);
    }

    const hasBlogger =
      info.scopes?.includes(
        'https://www.googleapis.com/auth/blogger'
      );

    if (hasBlogger) {
      ok('Blogger scope present');
    } else {
      bad('Missing blogger scope');
    }
  } catch (err: any) {
    logError(err);
  }
}

async function testBloggerAccess(auth: any) {
  section('6️⃣ Blogger Access');

  if (!auth) return;

  try {
    const blogger = google.blogger({
      version: 'v3',
      auth,
    });

    const blogs =
      await blogger.blogs.listByUser({
        userId: 'self',
      });

    const items = blogs.data.items || [];

    ok(`Found ${items.length} blog(s)`);

    let found = false;

    for (const blog of items) {
      console.log(
        `   • ${blog.name} (${blog.id})`
      );

      if (blog.id === env.BLOGGER_BLOG_ID) {
        found = true;
      }
    }

    if (found) {
      ok('BLOGGER_BLOG_ID matches');
    } else {
      bad('BLOGGER_BLOG_ID not found');
    }

    const detail =
      await blogger.blogs.get({
        blogId: env.BLOGGER_BLOG_ID,
      });

    ok(`Blog title: ${detail.data.name}`);
  } catch (err: any) {
    logError(err);
  }
}

async function testRead(auth: any) {
  section('7️⃣ Blogger Read Tests');

  if (!auth) return;

  try {
    const blogger = google.blogger({
      version: 'v3',
      auth,
    });

    const posts = await blogger.posts.list({
      blogId: env.BLOGGER_BLOG_ID,
    });

    ok(
      `Readable posts: ${
        posts.data.items?.length || 0
      }`
    );

    /**
     * Blogger API typings berbeda antar versi.
     * Parameter status harus berupa string[]
     * dan kadang overload TS gagal.
     */
    const drafts = await blogger.posts.list({
      blogId: env.BLOGGER_BLOG_ID,
      status: ['DRAFT'],
    });

    ok(
      `Readable drafts: ${
        drafts.data.items?.length || 0
      }`
    );
  } catch (err: any) {
    logError(err);
  }
}

async function testDraft(auth: any) {
  section('8️⃣ Blogger Draft Write');

  if (!auth) return;

  try {
    const blogger = google.blogger({
      version: 'v3',
      auth,
    });

    const result =
      await blogger.posts.insert({
        blogId: env.BLOGGER_BLOG_ID,
        isDraft: true,
        requestBody: {
          title: `[DRAFT TEST] ${Date.now()}`,
          content:
            '<p>Draft created from diagnostic.</p>',
        },
      });

    ok('Draft created');
    ok(`Post ID: ${result.data.id}`);
  } catch (err: any) {
    logError(err);
  }
}

async function testLivePublish(auth: any) {
  section('9️⃣ Blogger Live Publish');

  if (!auth) return;

  try {
    const blogger = google.blogger({
      version: 'v3',
      auth,
    });

    const result =
      await blogger.posts.insert({
        blogId: env.BLOGGER_BLOG_ID,
        isDraft: false,
        requestBody: {
          title: `[LIVE TEST] ${Date.now()}`,
          content:
            '<p>Live publish diagnostic.</p>',
        },
      });

    ok('Live publish successful');
    ok(`URL: ${result.data.url}`);
  } catch (err: any) {
    logError(err);
  }
}

async function testAdsterra() {
  section('🔟 Adsterra');

  try {
    const { AdsterraAgent } =
      await import('./agents/adsterra');

    const agent = new AdsterraAgent();

    const result = await agent.run({
      action: 'generate-layout',
      articleContent:
        '# Test\n\n## Intro\n\nLorem ipsum',
    });

    ok(`Success: ${result.success}`);
  } catch (err: any) {
    logError(err);
  }
}

async function main() {
  console.clear();

  console.log(`
╔══════════════════════════════════════════╗
║    AUTONOMOUS BLOGGER SEO DIAGNOSTIC     ║
╚══════════════════════════════════════════╝
`);

  await testEnvironment();
  await testGoogleAI();

  const auth = await createOAuthClient();

  await testGoogleAccount(auth);
  await testScopes(auth);
  await testBloggerAccess(auth);
  await testRead(auth);
  await testDraft(auth);
  await testLivePublish(auth);
  await testAdsterra();

  console.log('\n');
  console.log('════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('════════════════════════════════════');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
