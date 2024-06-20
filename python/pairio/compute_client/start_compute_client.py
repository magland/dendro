import os
import yaml
from .ComputeClientDaemon import ComputeClientDaemon


def start_compute_client(
    dir: str
):
    config_fname = os.path.join(dir, 'pairio-compute-client.yaml')
    if not os.path.exists(config_fname):
        raise Exception('This directory is not registered as a compute client. To register, run "pairio register-compute-client" in this directory.')

    with open(config_fname, 'r', encoding='utf8') as f:
        config = yaml.safe_load(f)

    compute_client_id = config['compute_client_id']
    compute_client_private_key = config['compute_client_private_key']
    compute_client_name = config['compute_client_name']
    service_name = config['service_name']

    daemon = ComputeClientDaemon(
        dir=dir,
        compute_client_id=compute_client_id,
        compute_client_private_key=compute_client_private_key,
        compute_client_name=compute_client_name,
        service_name=service_name
    )
    daemon.start()
