import { apiClient } from "./apiClient";

export interface AccountBadges {
  cartCount: number;
  wishlistCount: number;
}

let cached: AccountBadges | null = null;
let inFlight: Promise<AccountBadges> | null = null;

/**
 * Header counts for the cart and wishlist icons.
 *
 * The cart and wishlist contexts both need these on sign-in, but the header
 * only warrants one request — so the result is shared: whichever context asks
 * first triggers the fetch and the other rides along.
 */
export const meApi = {
  getBadges(): Promise<AccountBadges> {
    if (cached) return Promise.resolve(cached);
    if (inFlight) return inFlight;

    inFlight = apiClient
      .get<AccountBadges>("/me/badges")
      .then((badges) => {
        cached = badges;
        inFlight = null;
        return badges;
      })
      .catch((err) => {
        inFlight = null;
        throw err;
      });

    return inFlight;
  },

  /** Call when the signed-in user changes — the counts belong to that account. */
  reset() {
    cached = null;
    inFlight = null;
  },
};
