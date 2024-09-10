FROM python:3.9

# Install spikeinterface
RUN pip install spikeinterface==0.100.8
# don't install all the SI dependencies... instead manually specify the ones we need
RUN pip install scipy pynwb

# Install mountainsort5
RUN pip install mountainsort5==0.5.6

# Install dendro from github
RUN mkdir -p /src
WORKDIR /src
RUN git clone https://github.com/magland/dendro \
    && cd dendro \
    && cd python \
    && pip install -e . \
    && echo "v29"

# Install lindi from branch
WORKDIR /src
RUN git clone https://github.com/neurodatawithoutborders/lindi \
    && cd lindi \
    && git checkout lindi-tar \
    && pip install -e . \
    && echo "v7"

# Copy files into the container
COPY *.py /app/
COPY helpers/*.py /app/helpers/

# Set the working directory
WORKDIR /app