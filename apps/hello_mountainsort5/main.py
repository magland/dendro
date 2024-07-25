from pairio.sdk import App
from MountainSort5_1 import MountainSort5_1

app = App(
    app_name='hello_mountainsort5',
    description='Hello MountainSort5'
)

app.add_processor(MountainSort5_1)

if __name__ == '__main__':
    app.run()
