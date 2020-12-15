#!/bin/bash
echo "Starting blockchain-carbon-accounting repo"

echo "Checking for carbonAccounting network..."
./scripts/startNetwork.sh

echo "Starting CAs..."
./scripts/startCA.sh
echo "Starting client..."
./scripts/startCli.sh

echo "Generating crpyto and orgs..."
docker exec -it cli /bin/bash ./network.sh up

echo "Starting orderers, peers, and couchdb..."
sh ./scripts/startAndConnectNetwork.sh

echo "Creating the channel..."
docker exec -it cli /bin/bash ./network.sh createChannel

echo "Deploying CC..."
docker exec -it cli /bin/bash ./network.sh deployCC

echo "Starting the api..."
./scripts/startApi.sh