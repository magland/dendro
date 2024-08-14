import numpy as np
from typing import List

from pairio.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile


class SpikeSortingPostProcessingContext(BaseModel):
    input: InputFile = Field(
        description="Input NWB file in .nwb or .nwb.lindi.tar format"
    )
    output: OutputFile = Field(description="New NWB file in .nwb.lindi.tar format")
    electrical_series_path: str = Field(
        description="Path to the electrical series object in the NWB file"
    )
    units_path: str = Field(description="Path to the units object in the NWB file")
    n_jobs: int = Field(default=-1, description="Number of jobs to run in parallel")
    metric_names: List[str] = Field(
        default=[
            "firing_rate",
            "isi_violation",
            "rp_violation",
            "snr",
            "presence_ratio",
            "amplitude_cutoff",
            "amplitude_median",
        ],
        description="List of metric names to compute",
    )


class SpikeSortingPostProcessingDataset(ProcessorBase):
    name = "spike_sorting_post_processing"
    description = "Run post processing on an electrophysiology dataset after spike sorting and add columns to the units table"
    label = "spike_sorting_post_processing"
    image = "magland/pairio-hello-neurosift:0.1.0"
    executable = "/app/main.py"
    attributes = {}

    @staticmethod
    def run(context: SpikeSortingPostProcessingContext):
        import pynwb
        import lindi
        from qfc.codecs.QFCCodec import QFCCodec
        from helpers.nwbextractors import NwbRecordingExtractor, NwbSortingExtractor
        from helpers.make_float32_recording import make_float32_recording
        from helpers.compute_correlogram_data import compute_correlogram_data

        import spikeinterface as si
        import spikeinterface.postprocessing as spost

        si.set_global_job_kwargs(n_jobs=context.n_jobs)

        QFCCodec.register_codec()

        input = context.input
        output = context.output
        electrical_series_path = context.electrical_series_path
        units_path = context.units_path

        # Important: use of local cache causes severe slowdowns on dandihub
        # cache = lindi.LocalCache(cache_dir='lindi_cache')
        cache = None

        print("Creating LINDI file")
        url = input.get_url()
        assert url, "No URL for input file"
        with lindi.LindiH5pyFile.from_lindi_file(url) as f:
            f.write_lindi_file("output.nwb.lindi.tar")

        print("Opening LINDI file")
        with lindi.LindiH5pyFile.from_lindi_file(
            "output.nwb.lindi.tar", mode="r+", local_cache=cache
        ) as f:
            units = f[units_path]
            assert isinstance(units, lindi.LindiH5pyGroup)

            print("Reading NWB file")
            with pynwb.NWBHDF5IO(file=f, mode="a") as io:
                nwbfile = io.read()
                print("Loading recording")
                recording = NwbRecordingExtractor(
                    h5py_file=f, electrical_series_path=electrical_series_path
                )

                colnames = units.attrs["colnames"]
                if isinstance(colnames, np.ndarray):
                    colnames = colnames.tolist()
                else:
                    assert isinstance(colnames, list)

                print("Loading sorting")
                sorting = NwbSortingExtractor(
                    h5py_file=f,
                    unit_table_path=units_path,
                    electrical_series_path=electrical_series_path,
                )
                unit_ids = sorting.get_unit_ids()

                print("Writing float32 recording to disk")
                recording_binary = make_float32_recording(
                    recording, dirname="recording_float32"
                )

                analyzer = si.create_sorting_analyzer(
                    sorting, recording=recording_binary
                )
                qm_params = dict(
                    metric_names=context.metric_names,
                )
                analyzer.compute(
                    [
                        "random_spikes",
                        "templates",
                        "noise_levels",
                        "unit_locations",
                        "correlograms",
                        "quality_metrics",
                        "waveforms",
                    ],
                    extension_params=dict(quality_metrics=qm_params),
                )
                num_spikes = sorting.count_num_spikes_per_unit(outputs='array')
                peak_channels = si.get_template_extremum_channel(analyzer)
                peak_channels = [
                    peak_channels[unit_id].encode() if isinstance(peak_channels[unit_id], str) else peak_channels[unit_id]
                    for unit_id in sorting.get_unit_ids()
                ]

                colnames.append("num_spikes")
                units.create_dataset(
                    "num_spikes", data=num_spikes
                )

                colnames.append("peak_channel")
                # channel_dtype = recording.channel_ids.dtype
                units.create_dataset(
                    "peak_channel",
                    data=np.array(peak_channels)
                )

                # estimated unit locations
                unit_locations = analyzer.get_extension("unit_locations").get_data()
                colnames.append("estimated_x")
                units.create_dataset(
                    "estimated_x", data=unit_locations[:, 0], dtype=unit_locations.dtype
                )
                colnames.append("estimated_y")
                units.create_dataset(
                    "estimated_y", data=unit_locations[:, 1], dtype=unit_locations.dtype
                )
                if unit_locations.shape[1] == 3:
                    colnames.append("estimated_z")
                    units.create_dataset(
                        "estimated_z",
                        data=unit_locations[:, 2],
                        dtype=unit_locations.dtype,
                    )

                # quality metrics
                qm = analyzer.get_extension("quality_metrics").get_data()
                for metric_name in qm.columns:
                    colnames.append(metric_name)
                    x = qm[metric_name]
                    print(f"Writing metric {metric_name}")
                    print(x.dtype, x.shape)
                    if x.shape[0] == 1:
                        x = x.ravel()
                    units.create_dataset(
                        metric_name, data=x
                    )

                # # waveform mean and sd
                # templates_ext = analyzer.get_extension("templates")
                # template_means = templates_ext.get_templates(operator="mean")
                # templates_sd = templates_ext.get_templates(operator="std")
                # colnames.append("waveform_mean")
                # units.create_dataset(
                #     "waveform_mean", data=template_means, dtype=template_means.dtype
                # )
                # colnames.append("waveform_sd")
                # units.create_dataset(
                #     "waveform_sd", data=templates_sd, dtype=templates_sd.dtype
                # )

                # correlograms
                ccg, bins = analyzer.get_extension("correlograms").get_data()
                acgs = np.zeros((len(unit_ids), len(bins) - 1), dtype=np.uint32)
                # bins are in ms by default
                bin_edges_s = np.tile(bins, (len(unit_ids), 1)) / 1000
                for i in range(len(unit_ids)):
                    acgs[i] = ccg[i, i, :]

                colnames.append("acg")
                units.create_dataset("acg", data=acgs, dtype=np.uint32)
                colnames.append("acg_bin_edges")
                units.create_dataset(
                    "acg_bin_edges", data=bin_edges_s, dtype=bins.dtype
                )

                units.attrs["colnames"] = colnames

        print("Uploading output file")
        output.upload("output.nwb.lindi.tar")
