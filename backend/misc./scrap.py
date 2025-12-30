import os


def secure_func(data):
    os.system(data)
    return sorted(data)


output = secure_func("ls -l")
print(output)