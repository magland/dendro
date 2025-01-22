import os


def _process_is_alive(pid: str) -> bool:
    """
    Check if a process is alive.
    """
    try:
        os.kill(int(pid), 0)
        return True
    except OSError:
        return False
