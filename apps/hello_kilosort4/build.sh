#!/bin/bash

set -ex

this_dir=$(dirname $0)
cd $this_dir

bash make_spec.sh

docker build -t magland/dendro-hello-kilosort4:0.1.0 .

# prompt user to push to docker hub
echo "Do you want to push to docker hub? (y/n)"
read -r response
if [ "$response" = "y" ]; then
    docker push magland/dendro-hello-kilosort4:0.1.0
fi