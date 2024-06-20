import os
import yaml
import json
import base64


def register_compute_client(*,
    dir: str,
    compute_client_name: str,
    service_name: str
):
    # Let's make sure pubnub is installed, because it's required for the daemon
    try:
        import pubnub # noqa
    except ImportError:
        raise ImportError('The pubnub package is not installed. You should use "pip install pubnub" to install it.')

    config_fname = os.path.join(dir, 'pairio-compute-client.yaml')
    if os.path.exists(config_fname):
        raise Exception(f'This directory is already registered as a compute client. To re-register, delete the file {config_fname}.')

    url = f'https://pairio.vercel.app/register_compute_client/{service_name}/{compute_client_name}'

    print('')
    print(url)
    print('')

    print('Visit the above URL in your browser to register this compute client. Then enter the code you receive here:')
    code_base64 = input('Code: ')
    if not code_base64:
        return

    code_json = decode_base64(code_base64)
    code = json.loads(code_json)

    service_name = code['serviceName']
    compute_client_name = code['computeClientName']
    compute_client_id = code['computeClientId']
    compute_client_private_key = code['computeClientPrivateKey']

    with open(config_fname, 'w', encoding='utf8') as f:
        yaml.dump({
            'service_name': service_name,
            'compute_client_name': compute_client_name,
            'compute_client_id': compute_client_id,
            'compute_client_private_key': compute_client_private_key
        }, f)

    print('')
    print('The compute client has been registered. You can start it by running "pairio start-compute-client" in this directory')


def decode_base64(data):
    # Add padding if necessary
    missing_padding = len(data) % 4
    if missing_padding:
        data += '=' * (4 - missing_padding)
    return base64.b64decode(data).decode('utf-8')
