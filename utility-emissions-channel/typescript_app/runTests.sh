#!/bin/bash
echo "Starting fabric tests..."
docker exec -it api mocha ./tests
