FROM nvidia/cuda:12.4.1-devel-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3.11-dev git curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11

WORKDIR /app

COPY requirements.txt .
RUN python3.11 -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu124 torch==2.5.1 \
    && python3.11 -m pip install --no-cache-dir -r requirements.txt

COPY scripts/ ./scripts/

ENTRYPOINT ["python3.11"]
