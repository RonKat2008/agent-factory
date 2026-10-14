import { eveChannel } from "eve/channels/eve";
import { type AuthFn, extractBearerToken, localDev, vercelOidc, withAuthChallenges } from "eve/channels/auth";

/** Shared-secret bearer for operators and smoke tests: Authorization: Bearer $OPS_API_KEY. */
const opsApiKey: AuthFn<Request> = withAuthChallenges(
  (request) => {
    const expected = process.env.OPS_API_KEY;
    if (!expected) return null;
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token || token !== expected) return null;
    return { authenticator: "ops-api-key", principalId: "fleet-ops-operator", principalType: "user" };
  },
  [{ scheme: "Bearer" }],
);

export default eveChannel({
  auth: [opsApiKey, vercelOidc(), localDev()],
});
