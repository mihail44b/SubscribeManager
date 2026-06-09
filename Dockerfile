FROM python:3.11-slim

WORKDIR /code

# Системные зависимости для сборки библиотек Postgres
RUN apt-get update && apt-get install -y gcc libpq-dev cron && rm -rf /var/lib/apt/lists/*

# Ставим зависимости Python
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /code/requirements.txt

# Копируем проект
COPY ./app /code/app
COPY ./scripts /code/scripts
COPY .env /code/.env

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
