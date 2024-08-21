from dendro.sdk import App
from CebraNwbEmbedding5 import CebraNwbEmbedding5

app = App(
    app_name='hello_cebra',
    description='Example CEBRA processors'
)

app.add_processor(CebraNwbEmbedding5)

if __name__ == '__main__':
    app.run()
