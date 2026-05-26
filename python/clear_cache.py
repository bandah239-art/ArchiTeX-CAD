import shutil, pathlib
for p in pathlib.Path('.').rglob('__pycache__'):
    shutil.rmtree(p)
    print(f"Removed {p}")
print("All __pycache__ cleared.")
