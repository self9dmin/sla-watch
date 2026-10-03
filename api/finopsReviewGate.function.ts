import { appSettingsObjectsClient } from "@dynatrace-sdk/client-app-settings-v2";
import { currentFinopsReviewIsValid, type ReviewGateRequest } from "./finopsReviewGate";

/** Re-read the app's current review and routing controls before any local model call. */
export default async function (request: ReviewGateRequest) {
  const routing = await appSettingsObjectsClient.getAppSettingsObjects({
    schemaId: "finops-routing", addFields: "value", pageSize: 2,
  });
  const decisions = await appSettingsObjectsClient.getAppSettingsObjects({
    schemaId: "evidence-decisions", addFields: "value", pageSize: 500,
  });
  if (!currentFinopsReviewIsValid(request, routing, decisions)) {
    throw new Error("Current FinOps review or routing controls are unavailable or invalid.");
  }
  return { verified: true };
}
