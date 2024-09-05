from dendro.sdk import App
from CebraNwbEmbedding5 import CebraNwbEmbedding5
from CebraNwbEmbedding6 import CebraNwbEmbedding6

app = App(
    app_name='hello_cebra',
    description='Example CEBRA processors'
)

app.add_processor(CebraNwbEmbedding5)
app.add_processor(CebraNwbEmbedding6)

if __name__ == '__main__':
    app.run()
