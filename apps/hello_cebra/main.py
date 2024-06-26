from pairio.sdk import App
from CebraNwbEmbedding1 import CebraNwbEmbedding1
from CebraNwbEmbedding2 import CebraNwbEmbedding2

app = App(
    app_name='hello_cebra',
    description='Example CEBRA processors'
)

app.add_processor(CebraNwbEmbedding1)
app.add_processor(CebraNwbEmbedding2)

if __name__ == '__main__':
    app.run()
