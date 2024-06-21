FROM python:3.9

# Install pairio from github
RUN mkdir -p /src
WORKDIR /src
RUN git clone https://github.com/magland/pairio \
    && cd pairio \
    && cd python \
    && pip install -e . \
    && echo "v17"

# Copy files into the container
COPY *.py /app/

# Set the working directory
WORKDIR /app