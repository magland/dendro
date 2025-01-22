from typing import Any

class ProcessorBase:
    name: str
    description: str
    label: str
    image: str
    executable: str
    attributes: dict

    @staticmethod
    def run(
        context: Any
    ):
        raise NotImplementedError()
