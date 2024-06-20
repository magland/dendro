docker build -t magland/pairio-hello-world:0.1.0 .

# prompt user to push to docker hub
ok "Would you like to push the image to Docker Hub? (y/n)"
read -r response
if [ "$response" = "y" ]; then
    docker push magland/pairio-hello-world:0.1.0
fi