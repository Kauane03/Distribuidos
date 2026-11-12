FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./simulators

ENV PYTHONUNBUFFERED=1
ENV MQTT_HOST=mosquitto
ENV MQTT_PORT=1883

CMD ["python", "simulators/main.py", "--interscity", "http://interscity:8000", "--count", "500", "--interval", "3"]
