from dendro.sdk import App
from UnitsSummary1 import UnitsSummary1
from EphysSummary1 import EphysSummary1
from AviToMp4 import AviToMp4Processor
from EphysPreprocess import EphysPreprocess
from PrepareEphysSpikeSortingDataset import PrepareEphysSpikeSortingDataset
from MountainSort5 import MountainSort5
from SpikeSortingPostProcessing import SpikeSortingPostProcessingDataset

app = App(
    app_name='hello_neurosift',
    description='Neurosift processors'
)

app.add_processor(UnitsSummary1)
app.add_processor(EphysSummary1)
app.add_processor(AviToMp4Processor)
app.add_processor(EphysPreprocess)
app.add_processor(PrepareEphysSpikeSortingDataset)
app.add_processor(MountainSort5)
app.add_processor(SpikeSortingPostProcessingDataset)

if __name__ == '__main__':
    app.run()
