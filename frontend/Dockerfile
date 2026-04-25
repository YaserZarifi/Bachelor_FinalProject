# Use lightweight Node image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the frontend project
COPY . .

# Expose port 3000 to match our docker-compose configuration
EXPOSE 3000

# Command to run the development server on port 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
