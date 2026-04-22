import requests
import json

URL = 'https://script.google.com/macros/s/AKfycbxrpOaWum_dL1cYBx-OHd1zv8W6j0Sgr7VKRP3Fny505zP6ILIKTHmdL42wKBhH9V0j/exec'

try:
    response = requests.get(URL)
    print("Status Code:", response.status_code)
    # print(response.text[:500]) # Don't print too much
    data = response.json()
    print("Keys found in data:", data.keys() if isinstance(data, dict) else "Data is list")
    if 'data' in data:
        print("Data type:", type(data['data']))
        if isinstance(data['data'], list) and len(data['data']) > 0:
            print("First item sample:", data['data'][0])
        elif isinstance(data['data'], dict):
            print("Sub-keys:", data['data'].keys())

except Exception as e:
    print("Error:", e)
