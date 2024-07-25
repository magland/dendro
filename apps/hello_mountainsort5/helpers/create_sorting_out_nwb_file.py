import pynwb
from uuid import uuid4


def create_sorting_out_nwb_file(*, nwbfile_rec, sorting, sorting_out_fname):
    nwbfile = pynwb.NWBFile(
        session_description=nwbfile_rec.session_description,
        identifier=str(uuid4()),
        session_start_time=nwbfile_rec.session_start_time,
        experimenter=nwbfile_rec.experimenter,
        experiment_description=nwbfile_rec.experiment_description,
        lab=nwbfile_rec.lab,
        institution=nwbfile_rec.institution,
        subject=pynwb.file.Subject(
            subject_id=nwbfile_rec.subject.subject_id,
            age=nwbfile_rec.subject.age,
            date_of_birth=nwbfile_rec.subject.date_of_birth,
            sex=nwbfile_rec.subject.sex,
            species=nwbfile_rec.subject.species,
            description=nwbfile_rec.subject.description,
        ),
        session_id=nwbfile_rec.session_id,
        keywords=nwbfile_rec.keywords,
    )

    for ii, unit_id in enumerate(sorting.get_unit_ids()):
        st = sorting.get_unit_spike_train(unit_id) / sorting.get_sampling_frequency()
        nwbfile.add_unit(id=ii + 1, spike_times=st)  # must be an int

    # Write the nwb file
    with pynwb.NWBHDF5IO(sorting_out_fname, "w") as io:  # type: ignore
        io.write(nwbfile, cache_spec=True)  # type: ignore
