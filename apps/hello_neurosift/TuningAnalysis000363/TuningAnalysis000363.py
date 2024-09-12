from typing import List
import uuid
from dendro.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile


class TuningAnalysis000363Context(BaseModel):
    input: InputFile = Field(
        description="Input NWB file in .nwb or .nwb.lindi.tar format"
    )
    output: OutputFile = Field(description="Output NWB file in .nwb.lindi.tar format")
    units_path: str = Field(
        description="Path to the units table in the NWB file", default="/units"
    )
    behavior_paths: List[str] = Field(
        description="Paths to the behavior timeseries in the NWB file"
    )
    behavior_dimensions: List[int] = Field(
        description="Zero-based dimension indices to use for the behavior signal"
    )
    behavior_output_prefixes: List[str] = Field(
        description="Output prefixes for the behavior timeseries in the NWB file"
    )
    trials_path: str = Field(
        description="Path to the trials table in the NWB file",
        default="/intervals/trials",
    )


class TuningAnalysis000363(ProcessorBase):
    name = "tuning_analysis_000363"
    description = "Special analysis for 000363 Dandiset"
    label = "tuning_analysis_000363"
    image = "magland/dendro-hello-neurosift:0.1.0"
    executable = "/app/main.py"
    attributes = {}

    @staticmethod
    def run(context: TuningAnalysis000363Context):
        import lindi
        import numpy as np
        from qfc.codecs import QFCCodec
        from .behavior_signal_processing import BehaviorFun, FilterFun, Utils
        from .phase_tuning import compute_phase_tuning
        from scipy.ndimage import label, find_objects

        QFCCodec.register_codec()

        units_path = context.units_path
        behavior_paths = context.behavior_paths
        behavior_dimensions = context.behavior_dimensions
        behavior_output_prefixes = context.behavior_output_prefixes
        trials_path = context.trials_path

        if len(behavior_paths) != len(behavior_dimensions):
            raise ValueError(
                "behavior_paths and behavior_dimensions must have the same length"
            )
        if len(behavior_paths) != len(behavior_output_prefixes):
            raise ValueError(
                "behavior_paths and behavior_prefixes must have the same length"
            )

        input = context.input
        url = input.get_url()
        assert url

        if input.file_base_name.endswith(
            ".lindi.json"
        ) or input.file_base_name.endswith(".lindi.tar"):
            input_f = lindi.LindiH5pyFile.from_lindi_file(url)
        else:
            input_f = lindi.LindiH5pyFile.from_hdf5_file(url)

        # # Load the spike data
        spike_times: np.ndarray = input_f[f"{units_path}/spike_times"][()]  # type: ignore
        spike_times_index: np.ndarray = input_f[f"{units_path}/spike_times_index"][()]  # type: ignore
        # spike_trains = []
        # offset = 0
        # for i in range(len(spike_times_index)):
        #     st = spike_times[offset:int(spike_times_index[i])]
        #     # exclude the NaN from the spike times
        #     st = st[~np.isnan(st)]
        #     spike_trains.append(st)
        #     offset = int(spike_times_index[i])
        num_units = len(spike_times_index)
        print(f"Number of units: {num_units}")
        print(f"Total number of spikes: {len(spike_times)}")

        print("Creating output LINDI file")
        url = input.get_url()
        assert url, "No URL for input file"
        if input.file_base_name.endswith(
            ".lindi.json"
        ) or input.file_base_name.endswith(".lindi.tar"):
            with lindi.LindiH5pyFile.from_lindi_file(url) as input_f:
                input_f.write_lindi_file("output.nwb.lindi.tar")
        else:
            with lindi.LindiH5pyFile.from_hdf5_file(url) as input_f:
                input_f.write_lindi_file("output.nwb.lindi.tar")

        output_f = lindi.LindiH5pyFile.from_lindi_file("output.nwb.lindi.tar")

        for ii in range(len(behavior_paths)):
            position_path = behavior_paths[ii]

            position_name = position_path.split("/")[-1]
            output_phase_path = f'processing/behavior/{position_name}_phase'

            position_grp = input_f[position_path]
            assert isinstance(position_grp, lindi.LindiH5pyGroup)
            behavior_data = position_grp["data"][()]
            behavior_timestamps = position_grp["timestamps"][()]

            print("Computing phase")
            estimated_sample_rate = 1 / np.median(np.diff(behavior_timestamps))

            # behavior trace - keep only one channel
            behavior_trace = behavior_data[:, behavior_dimensions[ii]]  # type: ignore

            # [optional but recommended] Bandpass filter the data
            # TODO: expose this as a parameter
            signal_class = "jaw_movement"
            settings = BehaviorFun.signal_settings.get(
                signal_class, BehaviorFun.signal_settings["default"]
            )
            band_pass_cutoffs = settings["band_pass_cutoffs"]
            filtered_trace = FilterFun.filter_signal(
                behavior_trace,
                sampling_rate=estimated_sample_rate,
                filter_option=["bandpass", band_pass_cutoffs],
            )

            # [optional but recommended] Detect movement periods
            movement_mask = Utils.detect_movement_periods(
                filtered_trace, timestamps=behavior_timestamps
            )[0]

            # Compute phase
            phase = BehaviorFun.compute_phase_for_movement(
                filtered_trace,
                sample_rate=estimated_sample_rate,
                movement_mask=movement_mask,
            )[0]
            phase = np.real(phase).astype(np.float32)

            print("Extracting trials data")
            trial_data = input_f[trials_path]
            assert isinstance(trial_data, lindi.LindiH5pyGroup)
            # trial_id = trial_data['id'][()]
            # trial_uid = trial_data['trial_uid'][()]
            start_times = trial_data["start_time"][()]
            assert isinstance(start_times, np.ndarray)
            stop_times = trial_data["stop_time"][()]
            assert isinstance(stop_times, np.ndarray)
            # task = trial_data['task'][()]
            outcomes = trial_data["outcome"][()]
            assert isinstance(outcomes, np.ndarray)
            # instruction = trial_data['trial_instruction'][()]

            print("Computing trial mask")
            trial_label = "hit"
            trial_mask = outcomes == trial_label
            trial_mask = np.zeros_like(behavior_timestamps, dtype=bool)
            for ii in range(len(start_times)):
                if outcomes[ii] == trial_label:
                    # Mark the time points within the "hit" trial
                    trial_mask[
                        (behavior_timestamps >= start_times[ii])
                        & (behavior_timestamps <= stop_times[ii])
                    ] = True

            print("Computing combined mask")
            combined_mask = movement_mask & trial_mask

            print("Removing short epochs")
            min_duration = 0.5  # in seconds
            cleaned_combined_mask = remove_short_epochs(combined_mask, min_duration)

            print("Labeling epochs")
            labeled_mask, num_epochs = label(cleaned_combined_mask)  # type: ignore

            print("Finding epoch slices")
            epoch_slices = [epoch_slice[0] for epoch_slice in find_objects(labeled_mask)]

            print("Computing phase tuning")
            _, phase_stats = compute_phase_tuning(
                phase, behavior_timestamps, spike_times, spike_times_index, epoch_slices
            )
            phase_mean = [x[0] for x in phase_stats]
            phase_var = [x[1] for x in phase_stats]
            phase_p_value = [x[2] for x in phase_stats]

            print("Masking phase data")
            ts_masked = behavior_timestamps[~np.isnan(phase)]
            phase_masked = phase[~np.isnan(phase)]

            print("Writing to output LINDI file")
            print("Creating output phase timeseries")
            g = output_f.create_group(output_phase_path)
            g.attrs["description"] = "Phase timeseries"
            g.attrs["comments"] = "no comments"
            g.attrs["namespace"] = "core"
            g.attrs["neurodata_type"] = "TimeSeries"
            g.attrs["object_id"] = str(uuid.uuid4())
            x_d = g.create_dataset("data", data=phase_masked)
            x_d.attrs["conversion"] = 1
            x_d.attrs["offset"] = 0
            x_d.attrs["resolution"] = -1
            x_d.attrs["unit"] = "a.u."
            x_ts = g.create_dataset("timestamps", data=ts_masked)
            x_ts.attrs["interval"] = 1
            x_ts.attrs["unit"] = "seconds"

            print("Adding columns to units table")
            units = output_f[units_path]
            assert isinstance(units, lindi.LindiH5pyGroup)
            colnames = units.attrs["colnames"]
            if isinstance(colnames, np.ndarray):
                colnames = colnames.tolist()
            else:
                assert isinstance(colnames, list)

            prefix = behavior_output_prefixes[ii]
            print(f"Adding {prefix}_phase_mean")
            colnames.append(f"{prefix}_phase_mean")
            ds = units.create_dataset(
                f"{prefix}_phase_mean", data=np.array(phase_mean, dtype=np.float32)
            )
            ds.attrs["description"] = f"Phase mean for each unit ({prefix})"
            ds.attrs["namespace"] = "hdmf-common"
            ds.attrs["neurodata_type"] = "VectorData"
            ds.attrs["object_id"] = str(uuid.uuid4())

            print(f"Adding {prefix}_phase_var")
            colnames.append(f"{prefix}_phase_var")
            ds = units.create_dataset(
                f"{prefix}_phase_var", data=np.array(phase_var, dtype=np.float32)
            )
            ds.attrs["description"] = f"Phase variance for each unit ({prefix})"
            ds.attrs["namespace"] = "hdmf-common"
            ds.attrs["neurodata_type"] = "VectorData"
            ds.attrs["object_id"] = str(uuid.uuid4())

            print(f"Adding {prefix}_phase_p_value")
            colnames.append(f"{prefix}_phase_p_value")
            ds = units.create_dataset(
                f"{prefix}_phase_p_value",
                data=np.array(phase_p_value, dtype=np.float32),
            )
            ds.attrs["description"] = f"Phase p-value for each unit ({prefix})"
            ds.attrs["namespace"] = "hdmf-common"
            ds.attrs["neurodata_type"] = "VectorData"
            ds.attrs["object_id"] = str(uuid.uuid4())

            print("Updating colnames")
            units.attrs["colnames"] = colnames

        print("Uploading output file")
        context.output.upload("output.nwb.lindi.tar")


def remove_short_epochs(mask, min_duration: float):
    """Remove True epochs shorter than min_duration_samples."""
    import numpy as np
    assert isinstance(mask, np.ndarray)

    cleaned_mask = mask.copy()

    # Find the start and end of each True segment (movement periods)
    in_epoch = False
    start_idx = None

    for i in range(len(mask)):
        if mask[i] and not in_epoch:
            # Start of a True epoch
            start_idx = i
            in_epoch = True
        elif not mask[i] and in_epoch:
            # End of a True epoch
            end_idx = i
            assert start_idx is not None
            if (end_idx - start_idx) < min_duration:
                # If the epoch is shorter than the threshold, set it to False
                cleaned_mask[start_idx:end_idx] = False
            in_epoch = False

    # Handle the case where the last epoch goes until the end
    assert start_idx is not None
    if in_epoch and (len(mask) - start_idx) < min_duration:
        cleaned_mask[start_idx:] = False

    return cleaned_mask
