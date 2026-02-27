import time 
import os 
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import train

class RetrainHandler(FileSystemEventHandler):
    # watches for any new or changed .py files in the data folders

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.py'):
            print(f"Change detected: {os.path.basename(event.src_path)}")
            print("Starting automated retraining....")

            try:
                train.train()
                print("Retraining completed: Restart backend to apply")
            except Exception as e:
                print(f"❌ Retraining failed: {e}")

if __name__ == "__main__":
    # Path to watch
    path = os.path.join(os.getcwd(), "backend", "data")
    
    event_handler = RetrainHandler()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    
    print(f"👁️  Watcher started! Monitoring: {path}")
    print("Drop any .py file into clean/ or corrupted/ to retrain automatically.")
    
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()