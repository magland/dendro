import os
import yaml
from .ComputeClientDaemon import ComputeClientDaemon


def start_compute_client(*, dir: str, exit_when_idle: bool):
    CONTAINER_METHOD = os.environ.get("CONTAINER_METHOD")
    if not CONTAINER_METHOD:
        raise Exception("CONTAINER_METHOD environment variable must be set to either docker or apptainer")
    daemon = get_compute_client_daemon(dir=dir, exit_when_idle=exit_when_idle)
    daemon.start()


def get_compute_client_daemon(*, dir: str, exit_when_idle: bool):
    if os.environ.get("COMPUTE_CLIENT_ID"):
        compute_client_id = os.environ.get("COMPUTE_CLIENT_ID")
        compute_client_private_key = os.environ.get("COMPUTE_CLIENT_PRIVATE_KEY")
        compute_client_name = os.environ.get("COMPUTE_CLIENT_NAME")
        if not compute_client_id or not compute_client_private_key or not compute_client_name:
            raise Exception(
                "If COMPUTE_CLIENT_ID is set then COMPUTE_CLIENT_PRIVATE_KEY and COMPUTE_CLIENT_NAME must also be set"
            )
    else:
        config_fname = os.path.join(dir, "dendro-compute-client.yaml")
        if not os.path.exists(config_fname):
            raise Exception(
                'This directory is not registered as a compute client and the COMPUTE_CLIENT_ID env var is not set. To register, run "dendro register-compute-client" in this directory.'
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
