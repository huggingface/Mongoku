#!/bin/bash
#cd "$(dirname "$0")"
npm install
npm run build
cd app
npm install
npm run build
