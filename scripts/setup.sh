#!/bin/bash
nvm use v0.10.36

cd "$(dirname "$0")"
cd ../
make clean

cd lambda
DIRS=$(ls)

for DIR in $DIRS; do
    if [[ -d $DIR ]]; then
        cd $DIR
        npm install
        cd ../
    fi
done
cd ../
npm install
