# Use an official Node.js runtime as the base image
FROM node:16-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json files to the container
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Expose the port that the app will run on
EXPOSE 5004

# Start the application
CMD ["node", "index.js"]
