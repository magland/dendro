FROM python:3.9

# Install spikeinterface
RUN pip install spikeinterface==0.100.8
# don't install all the SI dependencies... instead manually specify the ones we need
RUN pip install scipy pynwb

# Install mountainsort5
RUN pip install mountainsort5==0.5.6

# Install pairio
RUN pip install pairio==0.5.8

# Install lindi
RUN pip install lindi==0.3.11

# Copy files into the container
COPY *.py /app/
COPY helpers/*.py /app/helpers/

# Set the working directory
WORKDIR /app