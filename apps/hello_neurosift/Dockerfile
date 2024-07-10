FROM python:3.9

# Install pairio from github
RUN mkdir -p /src
WORKDIR /src
RUN git clone https://github.com/magland/pairio \
    && cd pairio \
    && cd python \
    && pip install -e . \
    && echo "v22"

# Install spikeinterface
RUN pip install spikeinterface==0.100.8
# don't install all the SI dependencies... instead manually specify the ones we need
RUN pip install scipy pynwb

# Install lindi
RUN pip install lindi==0.3.11

# Copy files into the container
COPY *.py /app/
COPY helpers/*.py /app/helpers/

# Set the working directory
WORKDIR /app