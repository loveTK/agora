"""POST /convert (file, lang, position) -> 파일. 단계 8."""
from fastapi import FastAPI, UploadFile, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()
app.mount("/", StaticFiles(directory="static", html=True), name="static")
# ponytail: /convert 은 단계 8에서 추가. 지금은 index.html 서빙만.
