FROM pytorch/pytorch

# Install CEBRA
RUN pip install cebra==0.4.0

# Install git
RUN apt-get update && apt-get install -y git

# Install dendro from github
RUN mkdir -p /src
WORKDIR /src
RUN git clone https://github.com/magland/dendro \
    && cd dendro \
    && cd python \
    && pip install -e . \
    && echo "v30"

# Install lindi from branch
WORKDIR /src
RUN git clone https://github.com/neurodatawithoutborders/lindi \
    && cd lindi \
    && git checkout lindi-tar \
    && pip install -e . \
    && echo "v7"

# Install pynwb
RUN pip install pynwb

# Install qfc
RUN pip install qfc

# Copy files into the container
COPY *.py /app/

# Set the working directory
WORKDIR /app