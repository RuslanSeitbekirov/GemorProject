FROM python:3.15-rc-alpine3.23

WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt

CMD [ "python", "./app.py" ]