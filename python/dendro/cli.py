from typing import Union
import os
import socket
import click
from .compute_client.register_compute_client import (
    register_compute_client as register_compute_client_function,
)
from .compute_client.start_compute_client import (
    start_compute_client as start_compute_client_function,
)
from .compute_client.run_pending_job import run_pending_job as run_pending_job_function
from .sdk._make_spec_file import make_app_spec_file_function


# ------------------------------------------------------------
# Run compute client
# ------------------------------------------------------------
@click.command(help="Register a compute client in the current directory")
@click.option("--compute-client-name", default=None, help="Name of the compute client")
@click.option("--service-name", default=None, help="Name of the service")
def register_compute_client(
    compute_client_name: Union[str, None], service_name: Union[str, None]
):
    if service_name is None:
        service_name = input("Enter the name of the dendro service: ")
    if compute_client_name is None:
        default_compute_client_name = socket.gethostname()
        compute_client_name = input(
            f"Enter a unique name for the compute client [{default_compute_client_name}]: "
        )
        if compute_client_name == "":
            compute_client_name = default_compute_client_name
    register_compute_client_function(
        dir=".", compute_client_name=compute_client_name, service_name=service_name
    )


# ------------------------------------------------------------
# Start compute client
# ------------------------------------------------------------
@click.command(help="Start a compute client in the current directory")
@click.option("--exit-when-idle", is_flag=True, help="Exit when idle")
def start_compute_client(exit_when_idle: bool):
    start_compute_client_function(dir=".", exit_when_idle=exit_when_idle)


# ------------------------------------------------------------
# Run pending job
# ------------------------------------------------------------
@click.command(help="Run a pending job")
@click.argument("job_id", type=str)
@click.option("--compute-client-dir", default=None, help="Path to the compute client directory (if not specified, the DENDRO_API_KEY environment variable must be set)")
@click.option("--detach", is_flag=True, help="Detach from the job")
def run_pending_job(job_id: str, compute_client_dir: Union[str, None], detach: bool):
    if not compute_client_dir:
        user_api_key = os.environ.get("DENDRO_API_KEY")
        if not user_api_key:
            raise Exception(
                "Either --compute_client_dir or DENDRO_API_KEY environment variable must be set"
            )
        run_pending_job_function(
            job_id=job_id, compute_client_dir=None, user_api_key=user_api_key, detach=detach
        )
    else:
        run_pending_job_function(compute_client_dir=compute_client_dir, job_id=job_id)


# ------------------------------------------------------------
# Make app spec file
# ------------------------------------------------------------
@click.command(help="Make an app spec file")
@click.option("--app-dir", default=".", help="Path to the app directory")
@click.option("--spec-output-file", default=None, help="Output file for the spec")
def make_app_spec_file(app_dir: str, spec_output_file: str):
    make_app_spec_file_function(app_dir=app_dir, spec_output_file=spec_output_file)


# ------------------------------------------------------------
# Internal job monitoring process
# ------------------------------------------------------------
@click.command(help="Internal job monitoring process")
@click.argument(
    "monitor_type",
    type=click.Choice(["resource_utilization", "console_output", "job_status"]),
)
@click.option("--parent-pid", required=True, help="Parent PID")
def internal_job_monitor(monitor_type: str, parent_pid: str):
    if monitor_type == "resource_utilization":
        from .internal_job_monitoring.resource_utilization_monitor import (
            resource_utilization_monitor,
        )

        resource_utilization_monitor(parent_pid=parent_pid)
    elif monitor_type == "console_output":
        from .internal_job_monitoring.console_output_monitor import (
            console_output_monitor,
        )

        console_output_monitor(parent_pid=parent_pid)
    elif monitor_type == "job_status":
        from .internal_job_monitoring.job_status_monitor import job_status_monitor

        job_status_monitor(parent_pid=parent_pid)
    else:
        raise Exception(f"Unrecognized monitor_type: {monitor_type}")


# ------------------------------------------------------------
# Main cli
# ------------------------------------------------------------
@click.group(help="dendro command line interface")
def main():
    pass


main.add_command(register_compute_client)
main.add_command(start_compute_client)
main.add_command(run_pending_job)
main.add_command(make_app_spec_file)
main.add_command(internal_job_monitor)
