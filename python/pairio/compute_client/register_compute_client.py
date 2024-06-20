import os
import yaml


def register_compute_client(*,
    dir: str,
    compute_client_name: str
):
    # Let's make sure pubnub is installed, because it's required for the daemon
    try:
        import pubnub # noqa
    except ImportError:
        raise ImportError('The pubnub package is not installed. You should use "pip install pubnub" to install it.')

    config_fname = os.path.join(dir, '.pairio-compute-client.yaml')
    if os.path.exists(config_fname):
        raise Exception(f'This directory is already registered as a compute client. To re-register, delete the file {config_fname}.')

    url = f'https://pairio.vercel.app/register_compute_client/{compute_client_name}'

    print('')
    print(url)
    print('')

    print('Visit the above URL in your browser to register this compute client. Then enter the code you receive here:')
    code = input('Code: ')
    if not code:
        return

    code_parts = code.split('.')
    if len(code_parts) != 2:
        raise Exception('Invalid code.')

    compute_client_id = code_parts[0]
    compute_client_private_key = code_parts[1]

    with open(config_fname, 'w', encoding='utf8') as f:
        yaml.dump({
            'compute_client_id': compute_client_id,
            'compute_client_private_key': compute_client_private_key
        }, f)

    print('')
    print('The compute client has been registered. You can start it by running "pairio start-compute-client" in this directory')
