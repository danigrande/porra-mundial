import json
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

app = Flask(__name__)
CORS(app) # Allow the dashboard to call this API

# 1. Configuration
SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwUG7NAswIhcLn90C6JkA_Dt-45HBz8Klvmwij2UO0ilh85KUs6tUTz05-wALfTulnN/exec'
LM_STUDIO_URL = "http://localhost:1234/v1"

# Initialize LangChain LLM
llm = ChatOpenAI(
    base_url=LM_STUDIO_URL,
    api_key="lm-studio",
    temperature=0.8
)

def fetch_leaderboard_data():
    try:
        response = requests.get(SCRIPT_URL)
        data = response.json()
        return data.get('data', {})
    except Exception as e:
        print(f"Error fetching data: {e}")
        return {}

def load_user_profiles():
    try:
        # Fetch from the new 'getAllInfo' action in Google Apps Script
        response = requests.get(f"{SCRIPT_URL}?action=getAllInfo")
        data = response.json()
        if data.get('status') == 'success':
            return data.get('data', {})
        return {}
    except Exception as e:
        print(f"Error fetching user profiles: {e}")
        return {}

@app.route('/summary/<player_name>', methods=['GET'])
def get_summary(player_name):
    # Fetch all data
    all_players_data = fetch_leaderboard_data()
    profiles = load_user_profiles()
    
    if player_name not in all_players_data:
        return jsonify({"error": f"Jugador '{player_name}' no encontrado"}), 404
    
    player_stats = all_players_data[player_name]
    # Get profile from remote data, fallback to defaults
    profile = profiles.get(player_name, {
        "nickname": player_name,
        "likes": ["Fútbol"],
        "dislikes": ["Perder"],
        "humor_style": "Divertido y amigable"
    })
    
    # Prompt Template with 'Andres Montes' style
    template = ChatPromptTemplate.from_messages([
        ("system", """Eres un comentarista deportivo como el mítico Andrés Montes: excéntrico, divertido, carismático y con un lenguaje muy de la calle. 
        Tu objetivo es resumir la 'Porra Mundial 2026' para {nickname}.
        Usa un tono {humor_style}. Likes: {likes}. Dislikes: {dislikes}.
        Puedes usar sus frases típicas ('¡La vida puede ser maravillosa!', '¡Ratatatatata!', '¡Jugón!') y decir alguna grosería si encaja con el tono 'callejero'.
        """),
        ("human", """Datos de {player_name}: {player_stats}
        Haz un resumen corto (2-3 frases) que sea pura magia, analice su posición y le de un consejo 'jugón'.
        """)
    ])
    
    chain = template | llm
    
    try:
        response = chain.invoke({
            "humor_style": profile.get("humor_style", "excéntrico"),
            "nickname": profile.get("nickname", player_name),
            "likes": ", ".join(profile.get("likes", ["fútbol"])),
            "dislikes": ", ".join(profile.get("dislikes", ["perder"])),
            "player_name": player_name,
            "player_stats": json.dumps(player_stats)
        })
        
        summary_text = response.content
        
        # PERSISTENCE: Save back to Google Sheets
        try:
            requests.post(SCRIPT_URL, json={
                "action": "saveSummary",
                "playerName": player_name,
                "summary": summary_text
            })
        except Exception as pe:
            print(f"Error persisting summary: {pe}")
            
        return jsonify({"summary": summary_text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500



if __name__ == "__main__":
    print("Iniciando servidor en http://localhost:5000")
    app.run(port=5000, debug=True)
