from pairio.sdk import App
from CebraNwbEmbedding1 import CebraNwbEmbedding1
from CebraNwbEmbedding2 import CebraNwbEmbedding2
from CebraNwbEmbedding3 import CebraNwbEmbedding3
from CebraNwbEmbedding4 import CebraNwbEmbedding4
from CebraNwbEmbedding5 import CebraNwbEmbedding5

app = App(
    app_name='hello_cebra',
    description='Example CEBRA processors'
)

app.add_processor(CebraNwbEmbedding1)
app.add_processor(CebraNwbEmbedding2)
app.add_processor(CebraNwbEmbedding3)
app.add_processor(CebraNwbEmbedding4)
app.add_processor(CebraNwbEmbedding5)

if __name__ == '__main__':
    app.run()
