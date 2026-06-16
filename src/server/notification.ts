/* oxlint-disable import/no-named-as-default-member */
import webpush from 'web-push';

import { env } from '~/env';
import { type PushMessage } from '~/types';

const isVapidConfigured = Boolean(
  env.WEB_PUSH_EMAIL && env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY,
);

if (isVapidConfigured) {
  webpush.setVapidDetails(
    `mailto:${env.WEB_PUSH_EMAIL}`,
    env.WEB_PUSH_PUBLIC_KEY!,
    env.WEB_PUSH_PRIVATE_KEY!,
  );
}

export async function pushNotification(subscription: string, message: PushMessage) {
  if (!isVapidConfigured) {
    return { ok: false, statusCode: undefined, error: 'VAPID keys not configured on server' };
  }

  try {
    const _subscription = JSON.parse(subscription) as webpush.PushSubscription;
    const response = await webpush.sendNotification(_subscription, JSON.stringify(message));
    console.log('Push notification response', response);
    return { ok: true } as const;
  } catch (error) {
    console.error('Error sending push notification', error);
    const statusCode =
      'object' === typeof error &&
      null !== error &&
      'statusCode' in error &&
      'number' === typeof error.statusCode
        ? error.statusCode
        : undefined;
    const body =
      'object' === typeof error &&
      null !== error &&
      'body' in error &&
      'string' === typeof error.body
        ? error.body
        : undefined;

    return {
      ok: false,
      statusCode,
      error: body ?? (error instanceof Error ? error.message : 'Unknown error'),
    } as const;
  }
}
