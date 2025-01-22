import time
from ..common.api_requests import _post_api_request


_resolved_dandi_urls = {}

def resolve_dandi_url(
    url: str,
    *,
    job_id: str,
    job_private_key: str,
):
    if url in _resolved_dandi_urls:
        x = _resolved_dandi_urls[url]
        timestamp = x['timestamp']
        elapsed = time.time() - timestamp
        if elapsed < 60 * 20:
            return x['resolved_url']

    url_path = '/api/getSignedDownloadUrl'
    req = {
        'type': 'getSignedDownloadUrlRequest',
        'jobId': job_id,
        'url': url
    }
    headers = {
        'Authorization': f'Bearer {job_private_key}'
    }
    res = _post_api_request(
        url_path=url_path,
        data=req,
        headers=headers
    )
    if res['type'] != 'getSignedDownloadUrlResponse':
        raise Exception('Unexpected response for getSignedDownloadUrlRequest')
    signed_url = res['signedUrl']
    _resolved_dandi_urls[url] = {
        'timestamp': time.time(),
        'resolved_url': signed_url
    }
    return signed_url
