import sys
import os
import webview
from pathlib import Path

def main():
    if getattr(sys, 'frozen', False):
        base_dir = Path(sys._MEIPASS)
    else:
        base_dir = Path(__file__).resolve().parent

    html_file = base_dir / "index.html"
    
    if html_file.exists():
        html_content = html_file.read_text(encoding="utf-8")
    else:
        html_content = "<h1>Error: Game file not found</h1>"

    window = webview.create_window(
        title="Hollow Keep — Mohamed Kareem Games",
        html=html_content,
        width=1150,
        height=750,
        resizable=True,
        min_size=(800, 560)
    )
    webview.start()

if __name__ == "__main__":
    main()
