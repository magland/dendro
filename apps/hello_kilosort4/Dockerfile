FROM spikeinterface/kilosort4-base:4.0.12_cuda-12.0.0

# Install spikeinterface
RUN pip install spikeinterface==0.100.8
# don't install all the SI dependencies... instead manually specify the ones we need
RUN pip install scipy pynwb

# Install dendro from github
RUN mkdir -p /src
WORKDIR /src
RUN git clone https://github.com/magland/dendro \
    && cd dendro \
    && cd python \
    && pip install -e . \
    && echo "v31"

# Install lindi from prerelease
WORKDIR /src
RUN pip install lindi==0.4.0a2

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

# Set the working directory
WORKDIR /app