import os
import yaml
from .ComputeClientDaemon import ComputeClientDaemon


def start_compute_client(*, dir: str, exit_when_idle: bool):
    daemon = get_compute_client_daemon(dir=dir, exit_when_idle=exit_when_idle)
    daemon.start()


def get_compute_client_daemon(*, dir: str, exit_when_idle: bool):
    config_fname = os.path.join(dir, "dendro-compute-client.yaml")
    if not os.path.exists(config_fname):
        raise Exception(
            'This directory is not registered as a compute client. To register, run "dendro register-compute-client" in this directory.'
        )

    with open(config_fname, "r", encoding="utf8") as f:
        config = yaml.safe_load(f)

    compute_client_id = config["compute_client_id"]
    compute_client_private_key = config["compute_client_private_key"]
    compute_client_name = config["compute_client_name"]

    daemon = ComputeClientDaemon(
        dir=dir,
        compute_client_id=compute_client_id,
        compute_client_private_key=compute_client_private_key,
        compute_client_name=compute_client_name,
        exit_when_idle=exit_when_idle,
    )
    return daemon
