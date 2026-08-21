from fastapi import FastAPI

app = FastAPI(title="ChessIA API")


@app.get("/")
def read_root():
    return {"status": "ok"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
