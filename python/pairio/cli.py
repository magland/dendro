from typing import Union
import click
from .compute_client.register_compute_client import register_compute_client as register_compute_client_function
from .compute_client.start_compute_client import start_compute_client as start_compute_client_function
from .sdk._make_spec_file import make_app_spec_file_function


# ------------------------------------------------------------
# Compute client
# ------------------------------------------------------------
@click.command(help='Register a compute client in the current directory')
@click.option('--compute-client-name', default=None, help='Name of the compute client')
@click.option('--service-name', default=None, help='Name of the service')
def register_compute_client(
    compute_client_name: Union[str, None],
    service_name: Union[str, None]
):
    if service_name is None:
        service_name = input('Enter the name of the pairio service: ')
    if compute_client_name is None:
        compute_client_name = input('Enter a unique name for the compute client: ')
    register_compute_client_function(
        dir='.',
        compute_client_name=compute_client_name,
        service_name=service_name
    )

@click.command(help='Start a compute client in the current directory')
def start_compute_client():
    start_compute_client_function(
        dir='.'
    )


# ------------------------------------------------------------
# App cli
# ------------------------------------------------------------
@click.command(help='Make an app spec file')
@click.option('--app-dir', default='.', help='Path to the app directory')
@click.option('--spec-output-file', default=None, help='Output file for the spec')
def make_app_spec_file(app_dir: str, spec_output_file: str):
    make_app_spec_file_function(app_dir=app_dir, spec_output_file=spec_output_file)


# ------------------------------------------------------------
# Internal job monitoring process
# ------------------------------------------------------------
@click.command(help='Internal job monitoring process')
@click.argument('monitor_type', type=click.Choice(['resource_utilization', 'console_output', 'job_status']))
@click.option('--parent-pid', required=True, help='Parent PID')
def internal_job_monitor(monitor_type: str, parent_pid: str):
    if monitor_type == 'resource_utilization':
        from .internal_job_monitoring.resource_utilization_monitor import resource_utilization_monitor
        resource_utilization_monitor(parent_pid=parent_pid)
    elif monitor_type == 'console_output':
        from .internal_job_monitoring.console_output_monitor import console_output_monitor
        console_output_monitor(parent_pid=parent_pid)
    elif monitor_type == 'job_status':
        from .internal_job_monitoring.job_status_monitor import job_status_monitor
        job_status_monitor(parent_pid=parent_pid)
    else:
        raise Exception(f'Unrecognized monitor_type: {monitor_type}')

# ------------------------------------------------------------
# Main cli
# ------------------------------------------------------------
@click.group(help="dendro command line interface")
def main():
    pass

main.add_command(register_compute_client)
main.add_command(start_compute_client)
main.add_command(make_app_spec_file)
main.add_command(internal_job_monitor)
