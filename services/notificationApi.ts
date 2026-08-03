import { apiClient, ApiActor } from "./apiClient";

/**
 * Read-state for the derived admin notification feed.
 *
 * The feed is rebuilt from users, products and orders on every load, so there
 * is no notification row to flag. Each entry has a stable key (`user_<id>`,
 * `prod_<id>`, `ord_<id>`, …) and the keys an admin has read are stored against
 * their account, which is what makes "read" survive a refresh.
 */
export const notificationApi = {
  getReadKeys(actor?: ApiActor) {
    return apiClient.get<{ keys: string[] }>("/notifications/reads", { actor });
  },

  markRead(keys: string[], actor?: ApiActor) {
    return apiClient.post<{ keys: string[] }>("/notifications/reads", { keys }, { actor });
  },
};
