FROM python:3.9

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Install opencv
RUN pip install opencv-python

# Install spikeinterface
RUN pip install spikeinterface==0.101.0
# don't install all the SI dependencies... instead manually specify the ones we need
RUN pip install scipy pynwb numba

# Install mountainsort5
RUN pip install mountainsort5==0.5.6

# Install dendro from github
RUN mkdir -p /src
WORKDIR /src
RUN git clone https://github.com/magland/dendro \
    && cd dendro \
    && cd python \
    && pip install -e . \
    && echo "v32"

# Install lindi
RUN pip install lindi

# Install dandi
RUN pip install dandi

# Install qfc
RUN pip install qfc==0.3.6

# Install fork of hdmf until PR is merged
RUN git clone https://github.com/magland/hdmf \
    && cd hdmf \
    && git submodule update --init --recursive \
    && pip install -e . \
    && echo "v1"

# Copy files into the container
COPY *.py /app/
COPY helpers/*.py /app/helpers/
COPY TuningAnalysis000363/*.py /app/TuningAnalysis000363/

# Set the working directory
WORKDIR /app