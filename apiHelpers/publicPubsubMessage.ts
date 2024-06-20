const publishPubsubMessage = async (channel: string, message: any) => {
    const sub_key = process.env.PUBNUB_SUBSCRIBE_KEY;
    const pub_key = process.env.PUBNUB_PUBLISH_KEY;
    if (!sub_key) throw Error('Missing PUBNUB_SUBSCRIBE_KEY');
    if (!pub_key) throw Error('Missing PUBNUB_PUBLISH_KEY');
    const uuid = 'pairio';
    // payload is url encoded json
    const payload = JSON.stringify(message);
    const payload_encoded = encodeURIComponent(payload);
    const url = `https://ps.pndsn.com/publish/${pub_key}/${sub_key}/0/${channel}/0/${payload_encoded}?uuid=${uuid}`;
    const headers = {
        'Accept': 'application/json'
    };
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`Error publishing to pubsub: ${response.status} ${response.statusText}`);
    }
}

export default publishPubsubMessage;