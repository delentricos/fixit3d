from fastapi import FastAPI

app = FastAPI(
    title="FixIt3D API",
    version="0.0.1"
)


@app.get("/")
def root():
    return {
        "project": "FixIt3D",
        "status": "Backend running"
    }