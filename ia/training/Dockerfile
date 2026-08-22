FROM unsloth/unsloth:latest

WORKDIR /app

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-deps -r requirements.txt

# mlflow-skinny is the client-only package (tracking calls to a remote mlflow
# server) -- installed WITH its own deps (unlike the line above) since those
# deps (requests, pyyaml, protobuf, ...) are lightweight and independent of
# the torch/transformers stack we're careful not to disturb.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install mlflow-skinny

COPY scripts/ ./scripts/

ENTRYPOINT ["python3"]
