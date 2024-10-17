from dendro.sdk import App
from Rastermap import Rastermap

app = App(
    app_name='hello_rastermap',
    description='Rastermap'
)

app.add_processor(Rastermap)

if __name__ == '__main__':
    app.run()
