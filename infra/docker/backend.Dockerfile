FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN python -m venv /opt/poetry && /opt/poetry/bin/pip install --no-cache-dir poetry==2.3.3
ENV PATH="/opt/poetry/bin:$PATH"
ENV POETRY_VIRTUALENVS_IN_PROJECT=true
COPY backend/pyproject.toml backend/poetry.lock /app/
RUN poetry install --only main --no-interaction

COPY backend /app

EXPOSE 8000
