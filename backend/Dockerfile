FROM node:20-bookworm

WORKDIR /app/backend

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY backend/package*.json ./
RUN npm install

COPY python/requirements.txt /app/python/requirements.txt
RUN pip install --no-cache-dir --only-binary :all: --default-timeout=1000 --retries 10 -r /app/python/requirements.txt

COPY backend /app/backend
COPY python /app/python

EXPOSE 5000

CMD ["npm", "run", "dev"]
