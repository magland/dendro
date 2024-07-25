from pairio.sdk import (
    ProcessorBase,
    BaseModel,
    Field,
    InputFile,
    OutputFile,
    upload_additional_job_output,
)


class MountainSort5_1Context(BaseModel):
    input: InputFile = Field(
        description="Input NWB file in .nwb or .nwb.lindi.json format"
    )
    output: OutputFile = Field(description="Output data in .lindi.json format")
    electrical_series_path: str = Field(
        description="Path to the electrical series object in the NWB file"
    )
    segment_start_time_sec: float = Field(
        description="Start time of segment to analyze in seconds"
    )
    segment_duration_sec: float = Field(
        description="Duration of segment to analyze in seconds"
    )


class MountainSort5_1(ProcessorBase):
    name = "mountainsort5_1"
    description = "Run MountainSort5 on an electrophysiology dataset"
    label = "mountainsort5_1"
    image = "magland/pairio-hello-mountainsort5:0.1.0"
    executable = "/app/main.py"
    attributes = {}

    @staticmethod
    def run(context: MountainSort5_1Context):
        import lindi
        import h5py
        from nwbextractors import NwbRecordingExtractor
        import spikeinterface.preprocessing as spre

        electrical_series_path = context.electrical_series_path
        start_time_sec = context.segment_start_time_sec
        duration_sec = context.segment_duration_sec

        input = context.input
        url = input.get_url()
        assert url

        print("Loading file")
        local_cache = lindi.LocalCache(cache_dir="lindi_cache")
        if input.file_base_name.endswith(".lindi.json"):
            # f = lindi.LindiH5pyFile.from_lindi_file(url, local_cache=local_cache)

            input_fname = "input.nwb.lindi.json"
            input.download(input_fname)
            f = lindi.LindiH5pyFile.from_lindi_file(
                input_fname, local_cache=local_cache
            )
        else:
            f = lindi.LindiH5pyFile.from_hdf5_file(url, local_cache=local_cache)

        print("Gathering file information")
        g = f[electrical_series_path]
        assert isinstance(g, h5py.Group)
        ndt = g.attrs["neurodata_type"]
        if ndt != "ElectricalSeries":
            raise Exception(
                f"Invalid neurodata_type for electrical series object: {ndt} != ElectricalSeries"
            )

        print("Loading recording")
        recording = NwbRecordingExtractor(
            h5py_file=f, electrical_series_path=electrical_series_path
        )

        print("Extracting segment to analyze")
        recording = recording.frame_slice(
            start_frame=int(start_time_sec * recording.get_sampling_frequency()),
            end_frame=int(
                (start_time_sec + duration_sec) * recording.get_sampling_frequency()
            ),
        )

        print("Filtering recording")
        freq_max = min(6000, recording.get_sampling_frequency() / 2)
        if freq_max < 6000:
            print(f"Warning: setting freq_max to {freq_max} Hz")
        recording = spre.bandpass_filter(recording, freq_min=300, freq_max=freq_max)

        print("Getting channel ids")
        channel_ids = recording.get_channel_ids()

        print("Saving output")
        with open("units.h5", "wb") as f:
            with h5py.File(f, "w") as hf:
                hf.attrs["channel_ids"] = [str(ch) for ch in channel_ids]

        print("Uploading output")
        upload_h5_as_lindi_output(h5_fname="units.h5", output=context.output)


def upload_h5_as_lindi_output(h5_fname, output: OutputFile, remote_fname="output.h5"):
    import lindi

    h5_url = upload_additional_job_output(h5_fname, remote_fname=remote_fname)
    f = lindi.LindiH5pyFile.from_hdf5_file(h5_url)
    lindi_fname = h5_fname + ".lindi.json"
    f.write_lindi_file(lindi_fname)
    output.upload(lindi_fname)
