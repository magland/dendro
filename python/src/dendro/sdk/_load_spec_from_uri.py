import requests
import os
import json

def _load_spec_from_uri(uri: str) -> dict:
    # Convert github blob URL to raw URL
    if (uri.startswith('https://github.com/')) and ('/blob/' in uri):
        raw_url = uri.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/') + f'?cachebust={os.urandom(16).hex()}'
        print(f'URL: {raw_url}')
    else:
        raw_url = uri

    if raw_url.startswith('file://'):
        # Read the content from a local file
        with open(raw_url[len('file://'):], 'r', encoding='utf-8') as file:
            content = file.read()
    else:
        # Download the content
        response = requests.get(raw_url, timeout=60)
        response.raise_for_status()
        content = response.text

    data = json.loads(content)
    return data
