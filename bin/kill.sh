#! /bin/bash

kill $(lsof -i :8081 | grep node | awk  '{print $2}')