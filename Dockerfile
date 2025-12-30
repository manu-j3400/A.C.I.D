# Use a Python 3.9 base image
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies (needed for certain ML and PDF libraries)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from the middleware folder and install
# This ensures we use the version in your actual backend directory
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire project into the container
COPY . .

# Expose the port your Flask app uses
EXPOSE 5001

# Start BOTH the Watcher and the Flask App
# Note the path to app.py is now middleware/app.py
CMD /bin/bash -c "python3 watch_data.py & python3 middleware/app.py"
