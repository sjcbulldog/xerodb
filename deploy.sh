#!/bin/bash

npm run build
cp -r run.sh package.json package-lock.json dist content security ~/deploy/partdb
pushd ~/deploy/partdb
npm install
popd