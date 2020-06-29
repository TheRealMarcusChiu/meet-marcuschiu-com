#! /bin/bash

ssh ubuntu-server.local << EOF
    cd meet-marcuschiu-com/
    git pull origin master
    ./bin/kill.sh
# systemd auto redeploys
EOF