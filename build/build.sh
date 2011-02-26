#!/bin/bash
VER="2.0.1"
cp ../src/jquery.nub.js .
cp ../src/jquery.nub-list.js .
./minify.sh jquery.nub.js
./minify.sh jquery.nub-list.js
mkdir test
cp -r ../test/* test
tar zcvf jquery.nub.$VER.tgz *js test/*
zip jquery.nub.$VER.zip *js test/*
mv *.js ../dist
mv jquery.nub.$VER.tgz ../dist
mv jquery.nub.$VER.zip ../dist
rm -Rf test
