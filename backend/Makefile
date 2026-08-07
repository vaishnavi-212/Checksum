.PHONY: install test run calibrate lint

install:
	pip install -e ".[dev]"

test:
	pytest tests/ -v

run:
	uvicorn main:app --reload --host 0.0.0.0 --port 8000

calibrate:
	python scripts/calibrate_thresholds.py

lint:
	ruff check .
