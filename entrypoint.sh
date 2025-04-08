#!/bin/bash
set -e  # Exit on any error

# Ensure permissions for SSH
chown -R vibecoder:vibecoder /home/vibecoder/.ssh

# Start SSH daemon in the background
/usr/sbin/sshd -D &

# Switch to the 'vibecoder' user and keep the container running
exec su - vibecoder -c "tail -f /dev/null"
