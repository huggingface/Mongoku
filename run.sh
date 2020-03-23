#!/bin/bash
cd "$(dirname "$0")"
cd app
npm install
npm run build
cd ..
npm install
npm run build