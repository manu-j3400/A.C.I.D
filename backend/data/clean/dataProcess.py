def process_user_data(users):
    return {u['id']: u['name'].strip().lower() for u in users if 'name' in u}

raw_data = [{'id': 1, 'name': ' Alice '}, {'id': 2, 'name': 'BOB'}]
print(process_user_data(raw_data))