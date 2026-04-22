import json
import requests
from openai import OpenAI

# 1. THE ROBUST DATA TOOL (API Version)
def get_la_liga_table_api(api_token):
    # 'PD' is the code for Primera División (La Liga)
    url = "https://api.football-data.org/v2/competitions/PD/standings"
    headers = { 'X-Auth-Token': api_token }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        data = response.json()
        
        # The API returns a nested JSON structure. 
        # We navigate: standings -> [0] (total) -> table
        standings = data['standings'][0]['table']
        
        output = ["Current La Liga Standings:"]
        for entry in standings[:10]: # Top 10
            rank = entry['position']
            team = entry['team']['name']
            pts = entry['points']
            output.append(f"{rank}. {team} ({pts} pts)")
            
        return "\n".join(output)
        
    except Exception as e:
        return f"API Error: {str(e)}"

# 2. THE AGENT BRAIN
client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")
MY_API_TOKEN = "0fd0bf9a05224a22b42931e00b2c8764" # Paste your token from the email here

def run_agent(user_prompt):
    # We keep the same logic: Trigger -> Fetch -> Summarize
    messages = [
        {"role": "system", "content": "You are a football expert. If asked for standings, reply ONLY: FETCH_API"},
        {"role": "user", "content": user_prompt}
    ]

    # First Pass
    response = client.chat.completions.create(model="model-identifier", messages=messages)
    ai_thought = response.choices[0].message.content

    if "FETCH_API" in ai_thought:
        print("--- Calling Official API (Reliable) ---")
        real_data = get_la_liga_table_api(MY_API_TOKEN)
        
        # Final Pass
        final_messages = [
            {"role": "system", "content": "Answer the user using this official data."},
            {"role": "user", "content": f"DATA:\n{real_data}\n\nQUESTION: {user_prompt}"}
        ]
        final_res = client.chat.completions.create(model="model-identifier", messages=final_messages)
        return final_res.choices[0].message.content
    
    return ai_thought

if __name__ == "__main__":
    # Test it!
    print(run_agent("Who is leading the league and by how many points?"))