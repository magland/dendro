docker build -t magland/pairio-hello-world:0.1.0 .

# prompt user to push to docker hub
echo "Do you want to push to docker hub? (y/n)"
read -r response
if [ "$response" = "y" ]; then
    docker push magland/pairio-hello-world:0.1.0
fi