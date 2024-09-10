FROM python:3.9

# Install dendro from github
RUN mkdir -p /src
WORKDIR /src
RUN git clone https://github.com/magland/dendro \
    && cd dendro \
    && cd python \
    && pip install -e . \
    && echo "v29"

# Copy files into the container
COPY *.py /app/

# Set the working directory
WORKDIR /app