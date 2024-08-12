from pairio.sdk import App
from Kilosort4 import Kilosort4

app = App(
    app_name='hello_kilosort4',
    description='Hello Kilosort4',
)

app.add_processor(Kilosort4)

if __name__ == '__main__':
    app.run()
