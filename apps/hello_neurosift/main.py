from pairio.sdk import App
from UnitsSummary1 import UnitsSummary1

app = App(
    app_name='hello_neurosift',
    description='Neurosift processors'
)

app.add_processor(UnitsSummary1)

if __name__ == '__main__':
    app.run()
