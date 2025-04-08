FROM ubuntu:latest

# Update and install SSH server and other dependencies
RUN apt-get update && \
    apt-get install -y openssh-server curl sudo && \
    mkdir -p /var/run/sshd

# Create vibecoder user with sudo privileges
RUN useradd -m vibecoder && \
    echo "vibecoder ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/vibecoder && \
    chmod 0440 /etc/sudoers.d/vibecoder

# Configure SSH
RUN mkdir -p /home/vibecoder/.ssh && \
    chmod 700 /home/vibecoder/.ssh && \
    chown vibecoder:vibecoder /home/vibecoder/.ssh && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install anon-kode package
RUN npm install -g anon-kode

# Set user password (temporary for initial access)
RUN echo 'vibecoder:changeme' | chpasswd

# Add SSH config: set port to 2222
RUN echo "Port 2222" >> /etc/ssh/sshd_config

# Expose SSH port
EXPOSE 2222

# Set working directory to vibecoder's home directory
WORKDIR /home/vibecoder

# Remove previous CMD and add entrypoint to start sshd then login as vibecoder
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]