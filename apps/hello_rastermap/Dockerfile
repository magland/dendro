FROM python:3.9

# Install dendro
RUN pip install dendro && echo "v1"

# Install lindi
RUN pip install lindi

# Install scipy
RUN pip install scipy

# Install rastermap
RUN pip install rastermap

# Copy files into the container
COPY *.py /app/

# Set the working directory
WORKDIR /app