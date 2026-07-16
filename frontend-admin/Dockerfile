FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# Make installs resilient to flaky/slow networks (ECONNRESET auto-retries).
RUN npm config set fetch-retries 6 \
 && npm config set fetch-retry-mintimeout 15000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 600000 \
 && npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
