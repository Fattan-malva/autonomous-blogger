import { google, blogger_v3 } from 'googleapis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { OAuth2Client } from 'google-auth-library';

let bloggerClient: blogger_v3.Blogger | null = null;

function getAuthClient(): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    env.BLOGGER_CLIENT_ID,
    env.BLOGGER_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: env.BLOGGER_REFRESH_TOKEN,
  });

  return oauth2Client;
}

export function initBlogger(): void {
  const auth = getAuthClient();
  bloggerClient = google.blogger({ version: 'v3', auth });
  logger.info('Blogger client initialized');
}

export interface BloggerPost {
  id?: string;
  title: string;
  content: string;
  labels?: string[];
  url?: string;
  published?: string;
  updated?: string;
  status?: string;
}

export async function createPost(post: BloggerPost): Promise<BloggerPost> {
  if (!bloggerClient) {
    initBlogger();
  }

  try {
    const response = await bloggerClient!.posts.insert({
      blogId: env.BLOGGER_BLOG_ID,
      requestBody: {
        title: post.title,
        content: post.content,
        labels: post.labels || [],
      },
    });

    logger.info('Blogger post created', { postId: response.data.id });
    return {
      id: response.data.id || undefined,
      title: response.data.title || '',
      content: response.data.content || '',
      labels: response.data.labels || [],
      url: response.data.url || undefined,
      published: response.data.published || undefined,
      updated: response.data.updated || undefined,
      status: response.data.status || undefined,
    };
  } catch (error) {
    logger.error('Failed to create Blogger post', { error });
    throw error;
  }
}

export async function updatePost(postId: string, post: Partial<BloggerPost>): Promise<BloggerPost> {
  if (!bloggerClient) {
    initBlogger();
  }

  try {
    const response = await bloggerClient!.posts.update({
      blogId: env.BLOGGER_BLOG_ID,
      postId,
      requestBody: {
        title: post.title,
        content: post.content,
        labels: post.labels,
      },
    });

    logger.info('Blogger post updated', { postId });
    return {
      id: response.data.id || undefined,
      title: response.data.title || '',
      content: response.data.content || '',
      labels: response.data.labels || [],
      url: response.data.url || undefined,
      published: response.data.published || undefined,
      updated: response.data.updated || undefined,
      status: response.data.status || undefined,
    };
  } catch (error) {
    logger.error('Failed to update Blogger post', { error });
    throw error;
  }
}

export async function deletePost(postId: string): Promise<void> {
  if (!bloggerClient) {
    initBlogger();
  }

  try {
    await bloggerClient!.posts.delete({
      blogId: env.BLOGGER_BLOG_ID,
      postId,
    });
    logger.info('Blogger post deleted', { postId });
  } catch (error) {
    logger.error('Failed to delete Blogger post', { error });
    throw error;
  }
}

export async function getPost(postId: string): Promise<BloggerPost | null> {
  if (!bloggerClient) {
    initBlogger();
  }

  try {
    const response = await bloggerClient!.posts.get({
      blogId: env.BLOGGER_BLOG_ID,
      postId,
    });

    return {
      id: response.data.id || undefined,
      title: response.data.title || '',
      content: response.data.content || '',
      labels: response.data.labels || [],
      url: response.data.url || undefined,
      published: response.data.published || undefined,
      updated: response.data.updated || undefined,
      status: response.data.status || undefined,
    };
  } catch (error) {
    logger.error('Failed to get Blogger post', { error });
    return null;
  }
}

export async function listPosts(maxResults: number = 50): Promise<BloggerPost[]> {
  if (!bloggerClient) {
    initBlogger();
  }

  try {
    const response = await bloggerClient!.posts.list({
      blogId: env.BLOGGER_BLOG_ID,
      maxResults,
    });

    return (response.data.items || []).map((item) => ({
      id: item.id || undefined,
      title: item.title || '',
      content: item.content || '',
      labels: item.labels || [],
      url: item.url || undefined,
      published: item.published || undefined,
      updated: item.updated || undefined,
      status: item.status || undefined,
    }));
  } catch (error) {
    logger.error('Failed to list Blogger posts', { error });
    throw error;
  }
}
