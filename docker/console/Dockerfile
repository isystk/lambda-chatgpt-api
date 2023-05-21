FROM node:18-buster-slim 

RUN apt-get update && \
	apt-get install -y python3 python3-pip curl vim && \
	pip3 install awscli && \
	apt-get autoremove -y && \
	apt-get remove -y python3-pip && \
	apt-get clean && \
	rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app