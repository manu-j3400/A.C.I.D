import datetime
def log_event(message):
    with open("app.log", "a") as f:
        timestamp = datetime.datetime.now()
        f.write(f"[{timestamp}] {message}\n")