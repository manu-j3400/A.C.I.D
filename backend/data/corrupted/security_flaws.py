import os
import subprocess
import pickle
import base64
import sys

def insecure_sql_query(user_input):
    """
    Classic SQL Injection vulnerability
    """
    query = "SELECT * FROM users WHERE name = '" + user_input + "';"
    return query

def command_injection_os(filename):
    """
    Command Injection via os.system
    """
    os.system("cat " + filename)

def command_injection_popen(user_cmd):
    """
    Command Injection via popen
    """
    os.popen(user_cmd).read()

def dangerous_eval(expression):
    """
    Arbitrary code execution via eval
    """
    return eval(expression)

def dangerous_exec(code_str):
    """
    Arbitrary code execution via exec
    """
    exec(code_str)

def insecure_deserialization(data):
    """
    Unsafe pickle loading
    """
    return pickle.loads(data)

def path_traversal_open(filename):
    """
    Directory Traversal vulnerability
    """
    with open('/var/www/html/' + filename, 'r') as f:
        return f.read()

def hidden_payload_decode(encoded_str):
    """
    Obfuscated payload execution
    """
    decoded = base64.b64decode(encoded_str).decode('utf-8')
    exec(decoded)

def subprocess_shell_true(user_input):
    """
    Subprocess with shell=True is dangerous
    """
    subprocess.call("grep " + user_input + " file.txt", shell=True)
