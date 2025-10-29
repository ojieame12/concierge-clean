import type { Session } from '@shopify/shopify-api';

import { shopify } from '../../shopify';

export const createSession = (shopDomain: string, accessToken: string): Session => {
  const session = shopify.session.customAppSession(shopDomain);
  session.accessToken = accessToken;
  return session;
};

export const createRestClient = (session: Session) => new shopify.clients.Rest({ session });
