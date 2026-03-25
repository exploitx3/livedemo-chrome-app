#!/bin/bash
source prod-export.env
npm run config-env
rm -rf ./build
npm run build
7z a ./build.zip ./build


