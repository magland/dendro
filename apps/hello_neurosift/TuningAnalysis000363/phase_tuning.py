import numpy as np
from scipy.stats import circmean, circstd


def rayleigh_test(phases):
    """
    Perform the Rayleigh test for non-uniformity of circular data.

    Parameters:
    - phases: np.ndarray
        Array of phase angles in radians.

    Returns:
    - p_value: float
        p-value of the Rayleigh test.
    """
    n = len(phases)
    r = np.abs(np.sum(np.exp(1j * phases)) / n)  # mean resultant length
    z = n * r**2
    p_value = np.exp(-z) * (1 + (2 * z - z**2) / (4 * n) - (24 * z - 132 * z**2 + 76 * z**3 - 9 * z**4) / (288 * n**2))

    return p_value

def compute_phase_tuning(b_phase, b_timestamps, spike_times, spike_times_index, epochs):
    """
    Compute the tuning of each unit to the phase of body-part movement (e.g., jaw tracking signal)
    across all valid epochs (aggregated epochs).

    Parameters:
    - b_phase: np.ndarray
        The phase of the behavior signal.
    - b_timestamps: np.ndarray
        The timestamps of the behavioral data, needed for spike time alignment.
    - spike_times: np.ndarray
        The spike times for all units.
    - spike_times_index: np.ndarray
        Index pointing to the spikes for each unit.
    - epochs: list of slice objects
        Slices corresponding to the valid epochs from which to aggregate data.
        This is typically computed from a combined mask of behavior of interest (e.g., movement epochs) and ephys (e.g., correct trials). e.g.:
        labeled_mask, num_epochs = label(combined_mask)
        epochs = [epoch_slice[0] for epoch_slice in find_objects(labeled_mask)]

    Returns:
    - phase_stats: list
        Phase statistics for each unit.
    - phase_tuning: list
        Tuning properties for each unit.
    """

    # Initialize result structures
    phase_stats = []
    phase_tuning = []
    num_units = len(spike_times_index)
    num_bins = 32  # Number of phase bins (equivalent to pi/16 radians)

    # Loop through each unit
    for unit_num in range(num_units):
        # Extract spike times for the unit
        spike_times_index_with_zero_prepended = np.concatenate(([0], spike_times_index))
        unit_spike_times = spike_times[spike_times_index_with_zero_prepended[unit_num]:spike_times_index_with_zero_prepended[unit_num + 1]]

        # Initialize lists to aggregate spike times and corresponding phases
        unit_tuning = []
        aggregated_spike_phases = []

        # Process all epochs and aggregate spike phases
        for epoch in epochs:
            # Extract the start and stop times of the epoch
            epoch_start_time = b_timestamps[epoch.start]
            epoch_stop_time = b_timestamps[epoch.stop - 1]  # last index in slice

            # Find spikes that occur during the epoch
            spikes_in_epoch = (unit_spike_times >= epoch_start_time) & (unit_spike_times <= epoch_stop_time)
            if np.sum(spikes_in_epoch) == 0:
                continue

            # Get the spike times that occurred within this epoch
            spike_times_in_epoch = unit_spike_times[spikes_in_epoch]

            # Convert spike times to corresponding indices in the behavioral data
            spike_indices = np.searchsorted(b_timestamps, spike_times_in_epoch)

            # Get the behavioral phase values at the spike times and aggregate
            spike_phases = b_phase[spike_indices]
            aggregated_spike_phases.extend(spike_phases)

        if len(aggregated_spike_phases) == 0:
            phase_stats.append((np.nan, np.nan, np.nan))
            phase_tuning.append([])
            continue  # Skip if no spikes in all epochs

        # Convert to a numpy array for further analysis
        aggregated_spike_phases = np.array(aggregated_spike_phases)

        # Compute histogram of phases for spiking events
        edges = np.linspace(-np.pi, np.pi, num_bins + 1)
        # centers = (edges[:-1] + edges[1:]) / 2

        # Bin the aggregated phases
        phase_bins = np.digitize(aggregated_spike_phases, edges) - 1

        # Compute the spike-phase histogram
        spike_phase_pdf, _ = np.histogram(phase_bins, bins=np.arange(num_bins + 1), density=True)

        # Compute phase statistics using circular statistics
        mean_phase = circmean(aggregated_spike_phases)
        phase_variance = circstd(aggregated_spike_phases)

        # Perform Rayleigh test (r-test)
        p_value = rayleigh_test(aggregated_spike_phases)

        # Store the tuning properties if significant (p < 0.05)
        if p_value < 0.05:
            unit_tuning.append(np.rad2deg(mean_phase))

        # Append the computed stats
        phase_stats.append((mean_phase, phase_variance, p_value))
        phase_tuning.append(unit_tuning)

    return phase_tuning, phase_stats
