FROM pytorch/pytorch

# Install CEBRA
RUN pip install cebra==0.4.0

# Install git
RUN apt-get update && apt-get install -y git

# Install pairio from github
RUN mkdir -p /src
WORKDIR /src
RUN git clone https://github.com/magland/pairio \
    && cd pairio \
    && cd python \
    && pip install -e . \
    && echo "v22"

# Install lindi from branch
WORKDIR /src
RUN git clone https://github.com/neurodatawithoutborders/lindi \
    && cd lindi \
    && git checkout lindi-tar \
    && pip install -e . \
    && echo "v1"

# Copy files into the container
COPY *.py /app/

# Set the working directory
WORKDIR /app