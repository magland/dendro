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
        import numpy as np
        import lindi
        import h5py
        import pynwb
        from nwbextractors import NwbRecordingExtractor
        import spikeinterface.preprocessing as spre
        import spikeinterface as si
        from helpers.make_float32_recording import make_float32_recording
        from helpers._scale_recording_if_float_type import (
            _scale_recording_if_float_type,
        )
        from helpers.create_sorting_out_nwb_file import create_sorting_out_nwb_file
        import mountainsort5 as ms5

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
        num_frames = recording.get_num_frames()
        start_frame = int(start_time_sec * recording.get_sampling_frequency())
        end_frame = int(np.minimum(num_frames, (start_time_sec + duration_sec) * recording.get_sampling_frequency()))
        recording = recording.frame_slice(
            start_frame=start_frame,
            end_frame=end_frame
        )

        # bandpass filter
        print("Filtering recording")
        freq_min = 300
        freq_max = 6000
        recording_filtered = spre.bandpass_filter(
            recording, freq_min=freq_min, freq_max=freq_max, dtype=np.float32
        )  # important to specify dtype here

        print("Creating binary recording")
        recording_binary = make_float32_recording(
            recording_filtered, dirname="float32_recording"
        )

        print("Whitening")
        # see comment in _scale_recording_if_float_type
        recording_scaled = _scale_recording_if_float_type(recording_binary)
        recording_preprocessed: si.BaseRecording = spre.whiten(
            recording_scaled,
            dtype="float32",
            num_chunks_per_segment=1,  # by default this is 20 which takes a long time to load depending on the chunking
            chunk_size=int(1e5),
        )

        print("Setting up sorting parameters")
        detect_threshold = 6
        scheme1_detect_channel_radius = None
        detect_time_radius_msec = 0.5
        detect_sign = -1
        snippet_T1 = 20
        snippet_T2 = 50
        snippet_mask_radius = None
        npca_per_channel = 3
        npca_per_subdivision = 10
        scheme1_sorting_parameters = ms5.Scheme1SortingParameters(
            detect_threshold=detect_threshold,
            detect_channel_radius=scheme1_detect_channel_radius,
            detect_time_radius_msec=detect_time_radius_msec,
            detect_sign=detect_sign,
            snippet_T1=snippet_T1,
            snippet_T2=snippet_T2,
            snippet_mask_radius=snippet_mask_radius,
            npca_per_channel=npca_per_channel,
            npca_per_subdivision=npca_per_subdivision,
        )

        print("Sorting scheme 1")
        sorting = ms5.sorting_scheme1(
            recording=recording_preprocessed,
            sorting_parameters=scheme1_sorting_parameters,
        )

        print("Saving output")
        with pynwb.NWBHDF5IO(file=f, mode="r") as f_io:
            f_nwbfile = f_io.read()
            output_fname = "units.nwb"
            create_sorting_out_nwb_file(
                nwbfile_rec=f_nwbfile, sorting=sorting, sorting_out_fname=output_fname
            )

        print("Uploading output")
        upload_h5_as_lindi_output(h5_fname=output_fname, output=context.output)


def upload_h5_as_lindi_output(h5_fname, output: OutputFile, remote_fname="output.h5"):
    import lindi

    h5_url = upload_additional_job_output(h5_fname, remote_fname=remote_fname)
    f = lindi.LindiH5pyFile.from_hdf5_file(h5_url)
    lindi_fname = h5_fname + ".lindi.json"
    f.write_lindi_file(lindi_fname)
    output.upload(lindi_fname)
