#!/bin/bash

npm run build
if [ ! -f "~/deploy/xerodb" ]; then
    echo Making directory xerodb
    mkdir -p ~/deploy/xerodb
fi

cp -r run.sh package.json package-lock.json dist content security ~/deploy/xerodb
pushd ~/deploy/xerodb
npm install
popd
