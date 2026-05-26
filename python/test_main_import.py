# Test importing main
try:
    import main
    print("main: OK")
except Exception as e:
    import traceback
    traceback.print_exc()
    print("main: FAILED -", e)
