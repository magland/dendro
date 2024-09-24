import { isPublishResponse, PublishRequest, PublishTokenObject } from "./ephemeriPubsubTypes"; // remove .js for local dev
import crypto from "crypto";

const publishPubsubMessage = async (channel: string, message: any) => {
  const sub_key = process.env.VITE_PUBNUB_SUBSCRIBE_KEY;
  const pub_key = process.env.PUBNUB_PUBLISH_KEY;
  if (!sub_key) throw Error("Missing VITE_PUBNUB_SUBSCRIBE_KEY");
  if (!pub_key) throw Error("Missing PUBNUB_PUBLISH_KEY");
  const uuid = "dendro";
  // payload is url encoded json
  const payload = JSON.stringify(message);
  const payload_encoded = encodeURIComponent(payload);
  const url = `https://ps.pndsn.com/publish/${pub_key}/${sub_key}/0/${channel}/0/${payload_encoded}?uuid=${uuid}`;
  const headers = {
    Accept: "application/json",
  };
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Error publishing to pubsub: ${response.status} ${response.statusText}`,
    );
  }

  const EPHEMERI_PUBSUB_URL = process.env.EPHEMERI_PUBSUB_URL;
  const EPHEMERI_PUBSUB_API_KEY = process.env.EPHEMERI_PUBSUB_API_KEY;
  if ((EPHEMERI_PUBSUB_URL) && (EPHEMERI_PUBSUB_API_KEY)) {
    const url = `${EPHEMERI_PUBSUB_URL}/publish`;
    const messageJson = JSON.stringify(message);
    const publishTokenObject: PublishTokenObject = {
      timestamp: Date.now(),
      channel,
      messageSize: messageJson.length,
      messageSha1: sha1(messageJson),
    };
    const publishToken = JSON.stringify(publishTokenObject);
    const tokenSignature = sha1(`${publishToken}${EPHEMERI_PUBSUB_API_KEY}`);
    const req: PublishRequest = {
      type: 'publishRequest',
      publishToken,
      tokenSignature,
      messageJson
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    });
    if (!response.ok) {
      throw new Error(
        `Error publishing to ephemeri pubsub: ${response.status} ${response.statusText}`,
      );
    }
    const resp = await response.json();
    if (!isPublishResponse(resp)) {
      throw new Error(`Invalid response from ephemeri pubsub: ${JSON.stringify(resp)}`);
    }
  }
  else {
    console.warn("EPHEMERI_PUBSUB_URL or EPHEMERI_PUBSUB_API_KEY not set, skipping ephemeri pubsub");
  }
};

const sha1 = (input: string) => {
  const sha1 = crypto.createHash("sha1");
  sha1.update(input);
  return sha1.digest("hex");
};

export default publishPubsubMessage;
